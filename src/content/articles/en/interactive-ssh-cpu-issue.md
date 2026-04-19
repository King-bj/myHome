---
title: "Case Study: Troubleshooting High CPU Spikes Caused by Interactive SSH Connections"
description: "A detailed walkthrough of a production incident where SSH connections caused CPU spikes. Covers the complete troubleshooting process: problem identification, reproduction, root cause analysis, solutions, and long-term optimization strategies."
pubDate: 2026-04-02
tags:
  - SSH
  - Linux
  - DevOps
  - Performance Optimization
cover: https://images.jinla.fun/images/20260412-2acbe7cb-ssh.webp
slugZh: interactive-ssh-cpu-issue
---

Hello everyone! Today I'm documenting a production issue related to automation. This article covers the complete troubleshooting process—from problem identification and reproduction to root cause analysis, fixes, and long-term optimization strategies. I hope this helps anyone facing similar issues.

------

## 1. Background

### 1.1 Symptoms

A **2-core Linux server** frequently triggered high CPU usage alerts:

- Multiple **bash processes** continuously consumed CPU, with each process using about 50%. The combined usage exceeded 80%, and the overall CPU usage surpassed 90%, triggering alerts.

### 1.2 Initial Investigation

By analyzing process information, job logs, and timeline data, we identified the issue originated from the automation platform. The number of bash processes matched the number of automation jobs.

Upon inspecting the jobs, we found:

- All executed scripts/commands were simple (e.g., `top -n1`) with no compute-intensive logic.
- The high CPU usage times closely matched the SSH connection logs from automation jobs.

The initial finding: SSH connections were causing CPU spikes, and these spikes were short-lived.

The connection code:

```
channel = ssh.invoke_shell(term="dumb", width=2048)
```

After researching and consulting AI, we discovered that `invoke_shell` allocates a pseudo-terminal (PTY), which consumes significant resources.

To validate our conclusion, we stripped away business logic and **reproduced the issue with a minimal script**.

------

## 2. Reproducing the Issue

### Reproduction Approach

- Use Python to control remote SSH connections from the local machine.
- Monitor and collect CPU usage of `bash/sshd` processes on the remote server.
- Test both `invoke_shell` (PTY mode) and `exec_command` (non-PTY mode) separately.
- Compare peak CPU usage between the two modes.

### Reproduction Scripts (see the end of this article)

- Local machine: `ssh_pty_cpu_test.py` (controller + analyzer)
- Remote server: embedded `/tmp/remote_monitor.sh` (monitoring and data collection)

### Reproduction Results

- **PTY mode**: During connection, the bash process CPU usage spiked dramatically, averaging 40%+. After the connection was established, CPU dropped when executing commands.
- **Non-PTY mode**: CPU usage was minimal, typically below 5%.

------

## 3. Root Cause Analysis: Why Does PTY Consume So Much CPU?

The original code used:

```python
channel = ssh.invoke_shell(term="dumb", width=2048)
```

### Core Reason

`invoke_shell()` **allocates a pseudo-terminal (PTY)**, which puts the remote bash into **interactive mode**:

- It fully loads `.bashrc/.profile`, command history, prompts, and line editing features.
- It performs complex parsing for long command lines, multiple environment variables, and UTF-8 characters.
- Even when executing a single simple command, the entire initialization process runs.

### CPU Spike Chain

1. `invoke_shell` → Server allocates PTY
2. Send command → bash starts
3. **Interactive initialization + command parsing → CPU spikes**
4. Initialization complete → Execute actual command, CPU drops to the command's actual usage

------

## 4. Solutions

### 4.1 Short-term Solution

Since the user had no interactive automation job requirements, we switched the connection mode directly:

**From PTY → Non-PTY**

```python
channel = ssh.get_transport().open_session()
channel.set_combine_stderr(True)

env_cmd = (
    "source /etc/profile; "
    "[ -f ~/.bash_profile ] && source ~/.bash_profile; "
    "unset PROMPT_COMMAND; unset PS1; "
    f"cd {remotePath}; {remoteCmd}; exit $?"
)
channel.exec_command(env_cmd)
```

**Result**: CPU usage dropped immediately, and alerts stopped.

------

### 4.2 Long-term Solutions

#### Agent-based Execution (Original Product Design)

- Deploy an **automation job agent** on managed machines.
- Jobs execute locally, **completely eliminating SSH overhead**.
- Interactive commands are delivered through a dedicated session channel.

#### Smart Connection Mode (When Users Don't Want to Install Agents)

- **Determine if interaction is needed** before execution.
- Regular scripts/commands: **Non-PTY**
- Commands requiring interaction (like sudo, top): **PTY**
- Achieve minimal CPU overhead with maximum compatibility.

------

## 5. Interactive vs Non-interactive SSH Comparison

| Item | Interactive PTY (invoke_shell) | Non-interactive (exec_command) |
| :---: | :---------------------------: | :---------------------------: |
| PTY Allocation | Yes | No |
| CPU Usage | High | Very Low |
| Environment Loading | Full .bashrc/.profile | Basic environment only |
| Use Cases | Interactive commands requiring user input | Batch scripts, regular commands |
| Production Recommendation | Use only when necessary | Preferred for automation |

------

## 6. Common Pitfalls in Non-interactive Mode

1. `top` must use batch mode: `top -b -n1`
2. Avoid `pgrep` self-matching: use `pgrep -f jav[a]`
3. Environment variables must be explicitly loaded; don't rely on `.bashrc`
4. `sudo/passwd` and other interactive commands don't work in non-PTY mode

------

## 7. Potential Issues (Interactive vs Non-interactive SSH Execution)

While transitioning from `invoke_shell` (interactive) to `exec_command` (non-interactive), we noticed significant behavioral differences between the two modes. Although non-interactive execution is lighter and uses fewer resources, it comes with some practical pitfalls:

### 7.1 Non-interactive Mode Cannot Support Terminal-dependent Commands

For example, running:

```
ssh root@192.168.140.74 'top -n1'
```

Results in an error:

```
TERM environment variable not set.
```

This happens because terminal-based interactive programs like `top` depend on the `TERM` environment variable and terminal capabilities (such as cursor control, screen clearing, etc.). In non-interactive mode, SSH doesn't allocate a PTY, so `top` can't get terminal information and exits immediately.

✅ **Solutions**:

- Add the `-b` batch mode flag explicitly: `top -b -n1`
- Or set the `TERM` environment variable: `TERM=dumb top -b -n1`

> The issue isn't that `top` can't be used—it's about using the right mode.

### 7.2 Subcommand Execution Timing Can Cause Errors

A typical example:

```
ssh root@192.168.140.74 'sh t1.sh "$(pgrep -n -f java)"'
```

Our intention was to run `pgrep` on the **remote server** to get the PID of the newest Java process, then pass it to `t1.sh`.

However, without proper quoting, `$(pgrep ...)` might be expanded by the **local shell**, causing the local `pgrep` to run instead—leading to completely wrong results.

Even with proper quoting, another issue exists:

When SSH executes a command remotely, it actually runs it like this:

```
bash -c 'sh t1.sh "$(pgrep -n -f java)"'
```

The `pgrep -n -f java` uses fuzzy name matching, which might match the `bash -c ...` command itself (since the command line contains the keyword `java`). This causes `pgrep` to return its own PID instead of the actual Java service.

This results in **incorrect PID retrieval**.

✅ **Solutions**:

- Use the `[j]ava` trick to avoid self-matching:

```
ssh root@192.168.140.74 'sh t1.sh "$(pgrep -n -f jav[a])"'
```

This way, the `pgrep` command itself contains `jav[a]`, which won't match the literal `java`, avoiding self-matching.

- Or more reliably: wrap the logic in a script on the remote server to avoid complex inline commands.

### 7.3 Environment Variables and Special Characters Require Extra Attention

In non-interactive mode, the remote shell is typically a non-login, non-interactive `sh` or `bash -c`, which doesn't load `.bashrc`, `.profile`, or similar files.

This means:

- Some aliases, paths, and environment variables you're used to may not exist.
- Chinese characters and special symbols may have encoding issues on some systems.
- `PYTHONPATH`, `JAVA_HOME`, and other dependencies in your scripts must be set explicitly.

✅ **Recommendation**: Export all required environment variables explicitly in your commands. Don't rely on the remote user's default environment.

### 7.4 Multi-round Interaction Is Not Possible

This is the most obvious limitation. Commands that require multiple inputs—such as `sudo`, `vim`, `passwd`, and `mysql`—don't work properly in non-interactive mode.

For example:

```
ssh root@192.168.140.74 'sudo service restart nginx'
```

If a password is required, the command will hang or fail immediately.

## 8. Appendix: Reproduction Verification Script

### Local Script: ssh_pty_cpu_test.py

```python
import paramiko
import time
import pandas as pd
from datetime import datetime

HOST = "127.0.0.1"
USER = "ubuntu"

# Remote monitoring script path (all in /tmp)
REMOTE_SCRIPT = "/tmp/remote_monitor.sh"

# Remote monitoring script content (embedded in Python, auto-uploaded)
MONITOR_SCRIPT_CONTENT = '''#!/bin/bash
OUT=$1
echo "ts,pid,ppid,tty,pcpu,cmd" > "$OUT"
end=$((SECONDS + 5))

while [ $SECONDS -lt $end ]; do
    ts=$(date +%Y-%m-%dT%H:%M:%S.%3N)
    ps -eo pid,ppid,tty,pcpu,cmd | grep -E 'bash|sshd' | grep -v grep | \\
    awk -v ts="$ts" '{printf "%s,%s,%s,%s,%s,\\"%s\\"\\n", ts,$1,$2,$3,$4,substr($0,1,80)}'
    sleep 0.01
done >> "$OUT"
'''

def upload_remote_script(ssh):
    """Upload monitoring script to remote /tmp"""
    sftp = ssh.open_sftp()
    with sftp.file(REMOTE_SCRIPT, 'w') as f:
        f.write(MONITOR_SCRIPT_CONTENT)
    ssh.exec_command(f"chmod +x {REMOTE_SCRIPT}")
    sftp.close()
    time.sleep(0.2)

def cleanup_remote_files(ssh, log_remote_list):
    """Cleanup: monitoring script + all generated CSVs"""
    csv_files = " ".join(log_remote_list)
    ssh.exec_command(f"rm -f {REMOTE_SCRIPT} {csv_files}")
    time.sleep(0.2)

def get_remote_time(ssh):
    _, stdout, _ = ssh.exec_command("date +'%Y-%m-%d %H:%M:%S.%3N'")
    return stdout.read().decode().strip()

def single_test(is_pty, test_id):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, timeout=5)

    # Log in /tmp
    log_remote = f"/tmp/test_{test_id}.csv"

    # Start monitoring
    ssh.exec_command(f"nohup {REMOTE_SCRIPT} {log_remote} >/dev/null 2>&1 &")
    time.sleep(0.5)

    # Test PTY / Non-PTY
    if is_pty:
        chan = ssh.invoke_shell(term="dumb")
        time.sleep(0.3)
        chan.send("exit\n")
    else:
        chan = ssh.get_transport().open_session()
        chan.exec_command("sleep 0.3")
        chan.makefile("rb").read()

    time.sleep(4)

    # Download log
    sftp = ssh.open_sftp()
    log_local = f"temp_{test_id}.csv"
    sftp.get(log_remote, log_local)
    sftp.close()
    ssh.close()

    # Analyze CPU
    df = pd.read_csv(log_local)
    df["pcpu"] = pd.to_numeric(df["pcpu"], errors="coerce").fillna(0)

    if is_pty:
        target_df = df[df["cmd"].str.contains("-bash", na=False)]
    else:
        target_df = df[df["cmd"].str.contains("sshd", na=False)]

    return target_df["pcpu"].max() if not target_df.empty else 0.0

# ===================== Main Experiment Flow =====================
if __name__ == "__main__":
    print("=" * 80)
    print("    🧪 SSH PTY CPU Overhead Verification Experiment")
    print("=" * 80)

    # First establish connection to upload monitoring script
    print("\n📤 Uploading monitoring script to remote /tmp ...")
    init_ssh = paramiko.SSHClient()
    init_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    init_ssh.connect(HOST, username=USER, timeout=5)
    upload_remote_script(init_ssh)
    init_ssh.close()

    results = []
    remote_logs = []  # Record all remote CSVs for final cleanup

    # 5 tests
    for i in range(1, 6):
        print(f"\n🔹 Test #{i}...")
        pty_cpu = single_test(is_pty=True, test_id=f"pty_{i}")
        time.sleep(1)
        npty_cpu = single_test(is_pty=False, test_id=f"npty_{i}")
        time.sleep(1)

        results.append({
            "Test #": i,
            "PTY Mode Peak CPU(%)": round(pty_cpu, 1),
            "Non-PTY Mode Peak CPU(%)": round(npty_cpu, 1)
        })
        remote_logs.append(f"/tmp/test_pty_{i}.csv")
        remote_logs.append(f"/tmp/test_npty_{i}.csv")

    # Generate results table
    df_results = pd.DataFrame(results)
    stats = {
        "Test #": "Average",
        "PTY Mode Peak CPU(%)": round(df_results["PTY Mode Peak CPU(%)"].mean(), 1),
        "Non-PTY Mode Peak CPU(%)": round(df_results["Non-PTY Mode Peak CPU(%)"].mean(), 1)
    }
    df_final = pd.concat([df_results, pd.DataFrame([stats])], ignore_index=True)

    print("\n" + "="*80)
    print("    📊 Experiment Results")
    print("="*80)
    print(df_final.to_markdown(index=False))

    # Conclusion
    avg_pty = df_results["PTY Mode Peak CPU(%)"].mean()
    avg_npty = df_results["Non-PTY Mode Peak CPU(%)"].mean()

    print("\n" + "="*80)
    print("    🎯 Verification Conclusion")
    print("="*80)
    print(f"✅ PTY Mode Average CPU: {avg_pty:.1f}%")
    print(f"✅ Non-PTY Mode Average CPU: {avg_npty:.1f}%")
    print(f"✅ PTY Overhead = {avg_pty/max(avg_npty, 0.1):.1f}x Non-PTY")
    print("\n💡 Result: SSH PTY interactive mode significantly consumes CPU, while Non-PTY has minimal overhead.")
    print("="*80)

    # ===================== Auto Cleanup Remote Files =====================
    print("\n🧹 Cleaning up all temporary files on target...")
    clean_ssh = paramiko.SSHClient()
    clean_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    clean_ssh.connect(HOST, username=USER, timeout=5)
    cleanup_remote_files(clean_ssh, remote_logs)
    clean_ssh.close()
    print("✅ Target cleanup complete: /tmp/remote_monitor.sh + all CSVs deleted")
```

### Usage

1. Configure passwordless SSH login to the target machine:

```shell
# Generate key locally (if not exists)
ssh-keygen -t rsa -b 2048 -f ~/.ssh/id_rsa -N ""

# Copy public key to remote server
ssh-copy-id root@<remote-server-ip>
```

2. Run the test:

```
pip install paramiko pandas
python ssh_pty_cpu_test.py
```

3. Sample output:

```shell
================================================================================
    🧪 SSH PTY CPU Overhead Verification Experiment
================================================================================

📤 Uploading monitoring script to remote /tmp ...

🔹 Test #1...

🔹 Test #2...

🔹 Test #3...

🔹 Test #4...

🔹 Test #5...

================================================================================
    📊 Experiment Results
================================================================================
| Test #   |   PTY Mode Peak CPU(%) |   Non-PTY Mode Peak CPU(%) |
|:-------|----------------:|-----------------:|
| 1      |            50   |              3   |
| 2      |            66.6 |              0   |
| 3      |            50   |              0   |
| 4      |            50   |              3   |
| 5      |           100   |              3.1 |
| Average    |            63.3 |              1.8 |

================================================================================
    🎯 Verification Conclusion
================================================================================
✅ PTY Mode Average CPU: 63.3%
✅ Non-PTY Mode Average CPU: 1.8%
✅ PTY Overhead = 34.8x Non-PTY

💡 Result: SSH PTY interactive mode significantly consumes CPU, while Non-PTY has minimal overhead.
================================================================================

🧹 Cleaning up all temporary files on target...
✅ Target cleanup complete: /tmp/remote_monitor.sh + all CSVs deleted
```

Thanks for reading! I hope this helps. If you find any errors, please let me know.
