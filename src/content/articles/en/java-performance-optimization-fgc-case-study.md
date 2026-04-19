---
title: "From 2.8 Hours of FGC to Resolution: A Complete Java Performance Optimization Case Study"
description: "VM Thread CPU high, Old Gen 100% full, application response time spiked from 200ms to 5s+. This is a complete production incident troubleshooting record - from discovery to root cause to resolution. The root cause was a heap explosion caused by OkHttp retry storms."
pubDate: 2026-04-12
tags:
  - Java
  - JVM
  - Performance Optimization
  - GC
  - Debugging
cover: https://images.jinla.fun/images/20260412-4ae333fc-top.webp
slugZh: java-performance-optimization-fgc-case-study
---

# From 2.8 Hours of FGC to Resolution: A Complete Java Performance Optimization Case Study

> VM Thread CPU high, Old Gen 100% full, application response time spiked from 200ms to 5s+
>
> This is a complete production incident troubleshooting record - from discovery to root cause to resolution, taking 4 hours
>
> Root cause: Heap explosion caused by OkHttp retry storms

---

## Problem Symptoms

Production alert: Service CPU spiked abnormally from 20% to 100%

```
Symptoms:
- CPU usage: 20% → 100%
- Application response time: 200ms → 5s+
- VM Thread占用异常高
- Occasional timeout errors
```

**First reaction**: Is there a code logic issue? Or a thread in an infinite loop?

---

## Troubleshooting Process

### Step 1: Quickly Locate High CPU Thread (5 minutes)

```bash
# 1. Find the Java process with highest CPU usage
top -o %CPU
```

Found process PID: `1437734`

```bash
# 2. Find the thread with highest CPU usage in that process
top -H -p 1437734
```

Found thread TID: `1437747`, highest CPU usage

```bash
# 3. Convert TID to hexadecimal (required by jstack)
printf '%x\n' 1437747
```

Output: `15f033`

```bash
# 4. Get thread stack snapshot
jstack 1437734 > 1437734.txt

# 5. Check target thread stack
cat 1437734.txt | grep 15f033 -C 50
```

**Key finding**: Stack shows `VM Thread` consuming high CPU

---

### Step 2: Analyze Possible Causes of High VM Thread CPU (10 minutes)

VM Thread is an internal JVM thread, primarily responsible for GC operations. High CPU usage is usually due to:

| Possible Cause | Solution |
|----------------|----------|
| 🔁 Excessive biased lock revocation | Add `-XX:-UseBiasedLocking` |
| 🗑️ Frequent GC | Optimize heap size, choose appropriate GC (like G1) |
| 📊 Heavy APM agent | Reduce sampling rate, disable unnecessary monitoring |
| 🧵 Too many safepoints | Avoid frequent `System.gc()` calls |
| 🛠️ Frequent diagnostic operations | Avoid frequent `jstack`, `jmap` executions |

**Prioritize checking GC** - this is the most common cause.

---

### Step 3: GC Status Analysis (15 minutes)

```bash
# Continuously monitor GC status (output every 1 second)
jstat -gc 1437734 1000
```

#### Key Data Interpretation

| Metric | Value | Analysis |
|--------|-------|----------|
| **OC (Old Capacity)** | 699072 KB ≈ 682 MB | - |
| **OU (Old Used)** | 699071.9 KB | **Usage ≈ 100%** ⚠️ |
| **FGC (Full GC count)** | 4753 → 4756 (+3) | **3 times in 6 seconds** ⚠️ |
| **FGCT (Full GC total time)** | 10118 sec ≈ 2.8 hours | **Cumulative GC time** ⚠️ |
| **YGC (Young GC)** | 823 times, avg 20ms/time | Young GC normal |

**Core findings**:
- Old generation almost 100% full, unable to accommodate more object promotions
- Full GC extremely frequent: averaging once every 2 seconds, each taking about 2 seconds
- Cumulative Full GC time nearly 3 hours

**Conclusion**: The root cause of high VM Thread CPU is - **frequent Full GC requiring it to continuously coordinate Stop-The-World operations**.

---

### Step 4: Why is Old Gen So Full? (30 minutes)

Possible causes:

| Cause | Description |
|-------|-------------|
| 🐞 **Memory leak** | Objects held long-term (static collections, uncleared caches, unregistered listeners) |
| 📈 **Object promotion too fast** | Young generation too small or objects too large |
| 🔁 **Allocation too fast** | Object creation rate far exceeds GC recovery capacity |
| 🧱 **Improper heap settings** | Old generation or overall heap too small |
| 📡 **APM agent overhead** | Monitoring agents creating大量监控对象 |

**Need heap dump analysis to confirm.**

---

### Step 5: Heap Dump Analysis (1-2 hours)

```bash
# 1. Generate hprof file
jmap -dump:format=b,file=heap.hprof 1437734

# 2. Use jhat for analysis (JDK built-in)
jhat -J-Xmx512M heap.hprof

# 3. Access Web interface
# Browser opens http://<IP>:7000
```

#### Analyzing Heap Dump

In the jhat interface, check "heap histogram":

**Top object occupying memory**: `StackTraceElement`

Click to view specific instance reference relationships:

```
StackTraceElement holders:
  ↓ RetryAndFollowUpInterceptor.java:88
    ↓ intercept() method
```

**Key findings**:
- `RetryAndFollowUpInterceptor` is OkHttp's core interceptor
- Responsible for failure retry and redirect handling
- Large number of `StackTraceElement` objects created and held

**Root cause location**: This service calls many external interfaces for data aggregation and display. In this environment, most interfaces are unreachable, causing **OkHttp to frequently fail and retry**, creating大量异常对象 and stack traces.

---

## Solutions

### Immediate Actions
1. **Add request timeout control**: Avoid long blocking
2. **Limit retry attempts**: Change from default retry to fail-fast
3. **Disable non-core interface calls**: Reduce failure rate

### Long-term Optimization
1. **Optimize external call strategy**: Add circuit breaker mechanism
2. **Add caching layer**: Reduce dependency on external interfaces
3. **Adjust heap memory configuration**: Tune based on actual business volume

---

## Resolution Results

```
Before fix:
- CPU usage: 100%
- Application response time: 5s+
- Old generation usage: 100%
- Full GC: Once every 2 seconds

After fix:
- CPU usage: 25% (back to normal)
- Application response time: 200ms
- Old generation usage: ~60%
- Full GC: Significantly reduced frequency
```

---

## My Java CPU Issue Troubleshooting Methodology

Through this investigation, I've summarized a reusable methodology:

### Quick Location (5 minutes)
```bash
# 1. Find high CPU process
top -o %CPU

# 2. Find high CPU thread
top -H -p <pid>

# 3. Convert to hex
printf '%x\n' <tid>

# 4. Check thread stack
jstack <pid> | grep <hex_tid> -A 20 -B 20
```

### Distinguish Problem Type (10 minutes)
- **If application thread**: Check business code stack, find logic issues
- **If VM Thread**: 90% is GC problem
- **If C2 Compiler**: JIT compilation issue, usually transient

### GC Problem Analysis (30 minutes)
```bash
# Monitor GC status
jstat -gc <pid> 1000
```

**Decision framework**:
| YGC | FGC | Old Gen | Problem Type |
|-----|-----|---------|--------------|
| Normal | Normal | Normal | Not a GC problem |
| Normal | Frequent | Full | Object promotion too fast or memory leak |
| Frequent | Normal | - | Young generation too small or allocation too fast |
| Frequent | Frequent | - | Heap too small or overall allocation too fast |

### Root Cause Location (1-3 hours)
```bash
# 1. Generate heap dump
jmap -dump:format=b,file=heap.hprof <pid>

# 2. Analyze heap dump
# Method A: jhat (JDK built-in, lightweight)
jhat -J-Xmx4G heap.hprof

# Method B: Eclipse MAT (more powerful)
# Download: https://www.eclipse.org/mat/

# Method C: VisualVM (JDK built-in)
jvisualvm
```

**Analysis focus**:
1. Check "heap histogram", find the object type occupying most memory
2. Perform "Dominator Tree" analysis on that object, see who holds it
3. Trace back to the business code creating these objects

---

## Automation Script: One-Click High CPU Troubleshooting

To avoid repeating these steps, I wrote an automation script:

```bash
#!/bin/bash
#
# Function: One-click analysis of Java high CPU thread issues
# Output: Generate analysis report log file
# Usage: ./cpu_analysis.sh
#

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="high_cpu_thread_${TIMESTAMP}.log"

log() {
    echo "[$(date)] $*" | tee -a "$LOG_FILE"
}

log "Starting analysis of Java threads with high CPU usage..."

# 1. Find Java process with highest CPU
PID=$(ps -eo pid,ppid,cmd,%cpu --sort=-%cpu | grep java | grep -v grep | head -n1 | awk '{print $1}')

if [ -z "$PID" ]; then
    log "Error: No Java process found"
    exit 1
fi

log "Found Java process PID: $PID"

# 2. Find thread with highest CPU in that process
TID_LINE=$(ps -L -p $PID -o tid,tid,pcpu | tail -n +2 | sort -k2 -nr | head -n1)
TID=$(echo $TID_LINE | awk '{print $1}')
CPU_USAGE=$(echo $TID_LINE | awk '{print $2}')

log "Found high CPU thread TID: $TID, CPU usage: ${CPU_USAGE}%"

# 3. Convert to hexadecimal
TID_HEX=$(printf "%x" $TID)
log "TID hex: 0x$TID_HEX"

# 4. Get jstack
JSTACK_FILE="/tmp/jstack_${PID}.txt"
jstack $PID > $JSTACK_FILE 2>&1

# 5. Extract target thread stack
TARGET_LINE=$(grep -n "nid=0x$TID_HEX" $JSTACK_FILE | head -n1 | cut -d: -f1)

if [ -z "$TARGET_LINE" ]; then
    log "Warning: Thread 0x$TID_HEX not found"
    exit 1
fi

START_LINE=$((TARGET_LINE - 20))
END_LINE=$((TARGET_LINE + 20))

# 6. Output report
{
    echo "=========================================="
    echo "Java High CPU Thread Analysis Report"
    echo "Generated: $(date)"
    echo "=========================================="
    echo "Process PID: $PID"
    echo "Thread TID: $TID (0x$TID_HEX)"
    echo "CPU Usage: ${CPU_USAGE}%"
    echo ""
    echo "Thread Stack:"
    sed -n "${START_LINE},${END_LINE}p" $JSTACK_FILE
    echo "=========================================="
} >> "$LOG_FILE"

log "✅ Analysis complete! Report saved: $LOG_FILE"
```

### Usage

```bash
# 1. Save script copy the code above and save as cpu_analysis.sh

# 2. Add execute permission
chmod +x cpu_analysis.sh

# 3. Run
./cpu_analysis.sh

# 4. View report
cat high_cpu_thread_*.log
```

### Applicable Scenarios

- ✅ Java application with abnormally high CPU
- ✅ Need to quickly locate problem threads
- ✅ Unsure if it's a business or JVM issue

### Limitations

- ⚠️ Requires JDK environment (jstack command)
- ⚠️ Requires execute permission on target process
- ⚠️ Requires access to production server

---

## Key Takeaways

1. **VM Thread high CPU ≠ Code problem**: 90% is GC related
2. **Check GC first, then heap**: Use jstat to confirm GC status, jmap to find root cause
3. **Heap dump analysis is key**: Directly see what objects occupy the most memory
4. **Automate routine steps**: Turn repetitive work into scripts

---

## Troubleshooting Time

| Step | Time |
|------|------|
| Quick thread location | 5 minutes |
| GC status analysis | 15 minutes |
| Heap dump analysis | 1-2 hours |
| Problem resolution | 30 minutes |
| **Total** | **~2-3 hours** |

With automation script, first step can be reduced to 1 minute.

---

## Recommended Tools

| Tool | Purpose | Advantage |
|------|---------|-----------|
| **jstat** | GC monitoring | JDK built-in, real-time monitoring |
| **jmap** | Heap dump | JDK built-in, standard format |
| **jhat** | Heap analysis | JDK built-in, Web interface |
| **Eclipse MAT** | Heap analysis | Powerful, automatic leak analysis |
| **VisualVM** | Comprehensive analysis | JDK built-in, visual |
| **Arthas** | Online diagnostics | Alibaba open-source, production-friendly |
