# Redisson `PermitExpirableSemaphore` 源码解析

## 一、引言

在分布式任务调度、资源限流等场景中，我们常需要控制对共享资源的并发访问。标准的 `RSemaphore` 虽能实现并发控制，但其 `permit` 一旦被获取，若客户端异常退出，无法自动释放，易导致资源泄漏。

`RPermitExpirableSemaphore` 是 Redisson 提供的**可过期信号量**实现，它允许每个 `permit` 设置 TTL，并支持客户端通过心跳续期，服务端在 `permit` 过期后自动回收。这一机制极大提升了系统的健壮性。

本文将深入 `PermitExpirableSemaphore` 的底层实现，结合 Redis 数据结构与 Lua 脚本，解析其**如何实现 permit 的自动过期与原子回收**，并给出最佳实践建议。
<!-- more -->

## 二、核心数据结构设计

`RPermitExpirableSemaphore` 在 Redis 中使用三个关键结构协同工作：

| Key                            | 类型           | 作用                                 |
| ------------------------------ | -------------- | ------------------------------------ |
| `{semaphore-name}`             | String         | 存储当前可用的 permit 数量           |
| `{semaphore-name}:timeout`     | ZSet           | 存储 permit ID 与过期时间戳（score） |
| `redisson_sc:{semaphore-name}` | PubSub Channel | permit 释放或过期时通知等待者        |



### 示例数据：

```bash
# 1. 信号量计数器（String 类型，存储可用 permit 数量）
GET {semaphore-name}
# 例如：GET "host:192.168.1.1:script-100"
# 返回值：当前可用的 permit 数量，如 "2"

# 2. 过期时间有序集合（ZSet 类型）
# - member: permit ID（16字节二进制数据）  
# - score: 过期时间戳（毫秒）
ZRANGE {semaphore-name}:timeout 0 -1 WITHSCORES
# 例如：ZRANGE "host:192.168.1.1:script-100:timeout" 0 -1 WITHSCORES

# 3. 信号量变更通知频道（PubSub）
# 当有 permit 释放时发布通知，供等待的客户端订阅
PUBLISH redisson_sc:{semaphore-name} <available_permits>
# 例如：PUBLISH "redisson_sc:host:192.168.1.1:script-100" "1"
```

## 三、源码级实现原理

### 3.1 为什么不使用 Redis TTL？

一个直观想法是：为每个 permit 设置 Redis TTL，到期自动删除。

但 `PermitExpirableSemaphore` **并未依赖 Redis 的 TTL 机制**，原因如下：

1. **无法原子更新计数器**：TTL 过期是 Redis 自动行为，无法在过期时同步执行 `INCRBY {semaphore-name}`。
2. **数据不一致风险**：permit 已过期但计数器未更新，导致系统状态错乱。
3. **缺乏主动控制**：无法在客户端主动触发清理或续期。

因此，Redisson 采用 **主动清理 + Lua 脚本原子执行** 的方案。

### 3.2 核心 Lua 脚本：`tryAcquireAsync`

每次调用 `tryAcquire` 时，Redisson 会执行一段 Lua 脚本，完成“清理过期 permit → 尝试获取 → 入队等待”全流程。

#### 脚本入口：

```
org.redisson.RedissonPermitExpirableSemaphore.tryAcquireAsync(List<String> ids, long timeoutDate)
```

```
-- 参数说明:
-- KEYS[1] = 计数器 Key (用于表示当前可用信号量数量)
-- KEYS[2] = 等待队列 Key (ZSET，存储等待的请求 ID，按时间排序)
-- KEYS[3] = 通道名称（用于发布消息通知）
--
-- ARGV[1] = 请求的信号量数量 (permits)
-- ARGV[2] = 当前时间戳 (毫秒级)，用于 ZADD 分数
-- ARGV[3] = 过期时间戳（毫秒级），用于清理已超时的等待者
-- ARGV[4] = 预期的下一个等待者的分数（时间戳），用于检测是否轮到自己
-- ARGV[5] = 发布命令（如 PUBLISH），用于通知其他等待者
-- ARGV[6..n] = 请求的 ID 列表（如 request1, request2, ...）

-- 1. 查找并移除已过期的等待者
local expiredIds = redis.call('zrangebyscore', KEYS[2], 0, ARGV[3], 'limit', 0, ARGV[1])
if #expiredIds > 0 then
    -- 移除过期的等待者
    redis.call('zrem', KEYS[2], unpack(expiredIds))
    -- 将释放的信号量数量加回到计数器
    local value = redis.call('incrby', KEYS[1], #expiredIds)
    -- 如果计数器 > 0，则通过指定命令（如 PUBLISH）通知有新的信号量可用
    if tonumber(value) > 0 then
        redis.call(ARGV[5], KEYS[3], value)
    end
end

-- 2. 检查当前可用信号量是否足够
local value = redis.call('get', KEYS[1])
if value ~= false and tonumber(value) >= tonumber(ARGV[1]) then
    -- 信号量足够：直接获取
    redis.call('decrby', KEYS[1], ARGV[1])
    
    -- 将本次请求的 ID 加入等待队列（ZSET），分数为当前时间戳
    -- （即使获取成功，也加入队列用于后续超时管理）
    for i = 6, #ARGV, 1 do
        redis.call('zadd', KEYS[2], ARGV[2], ARGV[i])
    end
    
    -- 同步等待队列的过期时间（与计数器一致）
    local ttl = redis.call('pttl', KEYS[1])
    if ttl > 0 then
        redis.call('pexpire', KEYS[2], ttl)
    end
    
    return 'OK'
end

-- 3. 信号量不足，检查是否轮到当前请求（队列头部）
-- 获取等待队列中第一个元素（最早加入的）
local v = redis.call('zrange', KEYS[2], 0, 0, 'WITHSCORES')
if v[1] ~= nil and v[2] ~= ARGV[4] then
    -- 如果第一个元素的分数（时间戳）不等于预期值，说明还未轮到自己
    -- 返回 ':' + 分数，用于客户端重试延迟
    return ':' .. tostring(v[2])
end

-- 4. 返回 nil 表示需等待，但未超时，也未获取到
return nil
```

### 3.3 关键机制解析

#### 1）主动过期清理

- 每次 `tryAcquire` 都会触发 `zrangebyscore` 查询过期的 permit。
- 清理后立即执行 `incrby` 回收 permit 数量。
- 通过 `PUBLISH` 通知其他等待者，避免轮询。

#### （2）FIFO 公平性保证

- 使用 ZSet 按时间排序，实现先进先出。
- `ARGV[4]` 是客户端预期的“队列头时间戳”。
- 若当前队列头时间戳 ≠ 预期值，说明前面有其他请求，返回 `:` + 时间戳，客户端延迟重试。

#### （3）心跳续期机制

- 客户端通过 `updateLeaseTime(permitId, ttl)` 更新 permit 的过期时间。
- 内部执行 `zadd {semaphore}:timeout NX XX`，更新 ZSet 中的 score。
- 建议心跳间隔为 TTL 的 1/3，避免过期。

#### （4）自动回收闭环

```
permit 被获取 → 写入 ZSet（带过期时间）
        ↓
客户端崩溃或未释放
        ↓
下次 tryAcquire 触发 Lua 脚本
        ↓
zrangebyscore 扫描出过期 permit
        ↓
zrem 删除 + incrby 回收 permit
        ↓
PUBLISH 通知等待者
```

## 四、Java 使用实践

```
RPermitExpirableSemaphore semaphore = redisson.getPermitExpirableSemaphore("host:192.168.1.1:script-100");
semaphore.trySetPermits(2); // 设置最大并发数

// 获取 permit（带过期时间）
String permitId = semaphore.tryAcquire(60, TimeUnit.SECONDS);
if (permitId != null) {
    // 启动心跳
    semaphore.updateLeaseTime(permitId, 60, TimeUnit.SECONDS);

    try {
        // 执行任务...
    } finally {
        semaphore.release(permitId); // 释放
    }
}
```

### 4.2 心跳续期示例

```
ScheduledExecutorService heartbeatPool = Executors.newScheduledThreadPool(2);

Runnable heartbeatTask = () -> {
    try {
        boolean renewed = semaphore.updateLeaseTime(permitId, 60, TimeUnit.SECONDS);
        System.out.println("续期 permit: " + renewed);
    } catch (Exception e) {
        System.err.println("续期失败: " + e.getMessage());
    }
};

heartbeatPool.scheduleAtFixedRate(heartbeatTask, 20, 20, TimeUnit.SECONDS);
```

## 五、公平调度与超时处理

### **它不是传统意义上的 FIFO 队列，而是一种基于“释放顺序”的近似公平调度机制。**

### 1.核心设计思想

- **不存储等待者**：Redis 中不维护等待队列（如 `List`），仅通过 `{semaphore}:timeout` ZSet 存储**已获取 permit 的过期时间**。
- **虚拟队列头**：ZSet 中 score 最小的元素（即最早过期的 permit）被视为“下一个释放者”，构成逻辑上的“队头”。
- **客户端申报制**：客户端在尝试获取时，需传入“预期队头时间”。只有预期与真实一致，才允许继续尝试。

### 2. “公平性”的真实含义

| 类型                               | 是否保证 | 说明                                                   |
| ---------------------------------- | -------- | ------------------------------------------------------ |
| **严格 FIFO（谁先等，谁先得）**    | ❌ 否     | 受网络延迟、续期、客户端调度影响，可能出现“后到者先得” |
| **防插队（No Unfair Preemption）** | ✅ 是     | 新请求必须知道当前队头时间才能尝试，不能随意插队       |
| **防饥饿（Starvation-Free）**      | ✅ 是     | 所有等待者最终都会被唤醒并有机会获取 permit            |
| **基于释放顺序的调度**             | ✅ 是     | Permit 按释放顺序依次分配，形成有序竞争                |

### 3. 关键机制协同工作

| 机制                             | 作用                                    |
| -------------------------------- | --------------------------------------- |
| **Lua 脚本原子执行**             | 保证“检查 + 获取”是原子的，防止并发冲突 |
| **ZSet 最小 score 决定队头**     | 提供全局唯一的调度依据                  |
| **expectedHeadTimestamp 匹配**   | 实现“谁轮到了”的逻辑判断                |
| **PubSub 广播唤醒**              | 低延迟通知所有等待者，避免轮询          |
| **返回 `":timestamp"` 延迟重试** | 强制客户端按正确时间重试，防止无效请求  |

### 4. 典型场景下的行为

- **permit 正常释放**：下一个 permit 按 ZSet 顺序释放，等待者依次竞争。
- **permit 被 renew（续期）**：所有等待者的预期时间失效，必须更新为新的释放时间，无人能绕过规则。
- **网络差异导致响应延迟**：先等的客户端可能因网络慢而晚收到通知，后到者可能先获取——这是分布式系统的常态，非机制缺陷。

### 5. 适用性结论

- ✅ **适合**：高并发、轻量级限流、容忍轻微不公的场景。
- ⚠️ **不适合**：要求“绝对 FIFO”或“严格等待顺序”的强一致性场景。
- 适配严格顺序，需要自定义队列，在获取信号量时不进行等待直接快速失败来实现。



## 六、 避坑指南

### 1. 正确使用 API

```
// 错误：手动操作内部 Key
String key = "host:192.168.1.1:script-100:timeout";
redisson.getBucket(key).delete();

// 正确：使用官方 API
semaphore.release(permitId);
```

### 2. TTL 与心跳设置

- **TTL ≥ 任务最大执行时间 × 1.5**
- **心跳间隔 ≤ TTL / 3**，建议 20s ~ 30s
- 网络延迟高时，适当延长 TTL

### 3. 监控建议

```
# 监控队列长度
ZCARD "host:192.168.1.1:script-100:timeout"

# 监控即将过期的 permit（5 分钟内）
ZCOUNT "host:192.168.1.1:script-100:timeout" $(date +%s%3) $(date -d '+5 min' +%s%3)

# 监控可用 permit
GET "host:192.168.1.1:script-100"
```

建议接入 Prometheus + Grafana 做可视化告警。

### 4.  批量获取 vs 单个获取

- `tryAcquire(3, ...)` 是原子的，成功则获取 3 个。
- 循环调用 `tryAcquire(1, ...)` 3 次不是原子的，可能只获取到 1~2 个。
- 优先使用批量接口。

## 七、总结

`RPermitExpirableSemaphore` 是 Redisson 中一个设计精巧的分布式信号量实现，其核心价值在于：

1. **主动过期管理**：不依赖 Redis TTL，通过 Lua 脚本在每次操作中主动清理过期 permit。
2. **原子性保障**：清理、计数、通知在 Lua 脚本中一气呵成，避免数据不一致。
3. **自动回收闭环**：即使客户端崩溃，permit 也能被自动回收，系统具备自愈能力。
4. **公平调度**：基于 ZSet 实现 FIFO，保证任务顺序执行。
5. **可扩展性**：支持心跳续期、PubSub 通知、批量操作。

它不仅是一个并发控制工具，更是一个**高可用、防泄漏的分布式资源管理方案**。理解其底层实现，有助于我们在复杂分布式系统中做出更稳健的技术选型。