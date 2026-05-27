
## 问题现象

在 Kunpeng 920 环境下，应用程序的某个线程出现了异常的 CPU 利用率飙升，持续占用 CPU 资源，导致系统性能瓶颈。初步排查发现，该线程长期处于自旋状态。

<!-- more -->
## 版本说明
- **JCTools 版本**：v3.1.0
- **CPU**：Kunpeng 920（ARM 架构）
- **JDK**：OpenJDK 1.8.0_362


## 排查过程

使用 Arthas 工具监控应用程序，发现高 CPU 利用率时，`BaseMpscLinkedArrayQueue#poll` 方法（源自 JCTools）存在自旋现象，导致线程持续占用 CPU。

### 自旋代码分析

``` java
public E poll() {
    final E[] buffer = consumerBuffer;
    final long cIndex = lpConsumerIndex();
    final long mask = consumerMask;

    final long offset = modifiedCalcCircularRefElementOffset(cIndex, mask);
    Object e = lvRefElement(buffer, offset);
    if (e == null) {
        if (cIndex != lvProducerIndex()) {
            // 队列可能非空，进入自旋等待元素可见
            do {
                e = lvRefElement(buffer, offset);
            } while (e == null);
        } else {
            return null;
        }
    }

    if (e == JUMP) {
        final E[] nextBuffer = nextBuffer(buffer, mask);
        return newBufferPoll(nextBuffer, cIndex);
    }

    soRefElement(buffer, offset, null); // 释放元素
    soConsumerIndex(cIndex + 2);        // 更新消费者索引
    return (E) e;
}
```

在 ARM 架构下，由于其弱内存序模型，可能导致消费者线程在读取到 `producerIndex` 已更新的情况下，仍未能读取到对应槽位的有效数据，从而进入无限自旋。

## 问题原因分析

ARM 架构采用弱内存序模型，内存操作可能出现乱序执行。在上述代码中，消费者线程可能先读取到 `producerIndex` 的更新（例如扩容操作中的 +1），但由于槽位数据尚未更新，导致 `lvRefElement` 返回 `null`，从而进入自旋循环。由于 ARM 的缓存一致性机制可能延迟数据的可见性，消费者线程可能长时间无法读取到有效数据，导致无限自旋。[GitHub](https://github.com/kunpengcompute/kunpengcompute.github.io/issues/46?utm_source=chatgpt.com)

## 解决方案

为了解决该问题，可以在进入自旋之前，增加对生产者和消费者索引差值的判断，确保只有在确实有新元素可消费时才进入自旋。

### 修改后的代码

``` java
public E poll() {
    final E[] buffer = consumerBuffer;
    final long cIndex = lpConsumerIndex();
    final long mask = consumerMask;

    final long offset = modifiedCalcCircularRefElementOffset(cIndex, mask);
    Object e = lvRefElement(buffer, offset);
    if (e == null) {
        long pIndex = lvProducerIndex();
        // 判断队列是否为空
        if ((cIndex - pIndex) / 2 == 0) {
            return null;
        }
        // 队列可能非空，进入自旋等待元素可见
        do {
            e = lvRefElement(buffer, offset);
        } while (e == null);
    }

    if (e == JUMP) {
        final E[] nextBuffer = nextBuffer(buffer, mask);
        return newBufferPoll(nextBuffer, cIndex);
    }

    soRefElement(buffer, offset, null); // 释放元素
    soConsumerIndex(cIndex + 2);        // 更新消费者索引
    return (E) e;
}
```

通过在自旋前增加 `(cIndex - pIndex) / 2 == 0` 的判断，确保只有在确实有新元素可消费时才进入自旋，从而避免了在 ARM 架构下由于内存操作乱序导致的无限自旋问题。

## 结论

在 ARM 架构下，由于其弱内存序模型，可能导致多线程并发队列在扩容或元素插入过程中出现状态不一致，从而导致消费者线程进入无限自旋。通过在消费者线程中增加对生产者和消费者索引差值的判断，可以有效避免该问题，提高系统的稳定性和性能。

该问题已在 JCTools 的 Issue #355 中被提出，并在后续版本中得到修复。



参考：

[NettyClientWorkerThread cpu 100% · Issue #11956 · netty/netty](https://github.com/netty/netty/issues/11956)

[OOM can cause linked array qs to break · Issue #355 · JCTools/JCTools · GitHub](https://github.com/JCTools/JCTools/issues/355)

[关于原子操作和弱内存序 · Issue #46 · kunpengcompute/kunpengcompute.github.io](https://github.com/kunpengcompute/kunpengcompute.github.io/issues/46?utm_source=chatgpt.com)

[netty thread was infinite loop in BaseMpscLinkedArrayQueue.poll · Issue #13137 · netty/netty](https://github.com/netty/netty/issues/13137)