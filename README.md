_**by wangxiao 2015/01/27**_
# LeanCloud 推送服务 JavaScript SDK

## 简介

感谢您使用 JavaScript 的 Push SDK，LeanCloud 的 Push 服务每天处理超过百万级的请求，安全可靠，您的明智之选。发送 Push 服务是基于 HTTP 的一个 Post 请求，接收 Push 消息是通过 WebSocket 来监听数据，SDK 对数据进行过包装，并且会对连接产生的错误进行处理，包括网络断开重连等，所以稳定可靠。

您可以基于 Push SDK 做很多有趣的 Web App，比如：年会上面做个简单的弹幕应用，一些客户端发，弹幕墙接收。当然，您可以做一个比较简单的消息通知功能。推送消息的方式也是很灵活的，可以在客户端通过对应 SDK 的接口发送，也可以在「控制台」- 「消息」中手动发送推送消息到各个客户端。

如果是纯前端使用 JavaScript SDK，请务必配置「控制台」-「设置」-「基本信息」-「JavaScript 安全域名」，防止其他人盗用您的服务器资源。


## 全局命名空间

### AV

LeanCloud JavaScript 相关 SDK 都会使用「AV」作为命名空间。

### 方法
#### AV.push(options)

描述：配置一个 Push 服务，生成一个 PushObject，提供后续调用的方法。

参数：

* options {Object} （必须） 配置 Push 服务的参数。其中包括：

    * appId {String} （必须）应用的 AppId，在「控制台」-「设置」-「基本信息」中可以查看；

    * appKey {String}（必须）应用的 AppKey；

    * channels {Array}（可选）Push 的频道。默认不传，会发到所有频道；


返回：{Object} 返回 pushObject，可以做后续 Push 服务的方法，支持链式。

例子：


```js
var pushObject = AV.push({
    appId: 'abcdefg123',
    appKey: 'qwertyuio222',
    channels: ['aaa', 'bbb']
}).open(function() {
    console.log('receiving message...');
}).on('message', function(data) {
    console.log(data);
}).send({
    data: {test: 123},
    channels:['aaa']
});
```

#### AV.push.version

描述：获取当前 SDK 的版本信息

返回：{String} 返回当前版本

例子：

```js
console.log(AV.push.version);   // 2.0.0
```

#### pushObject.open(callback)

描述：开启接收服务端推送消息。如果只是需要发送数据到服务器，则不需要使用该方法，只需要使用 send 方法；

参数：

* callback {Function}（可选）与服务器建立连接（WebSocket）之后，会触发的回调函数

返回：{Object} 返回 pushObject，可以做后续 Push 服务的方法，支持链式。

例子：

```js
pushObject.open(function() {
    console.log('open');
});
```

#### pushObject.send(jsonObject)

描述：向服务器发送要推送的消息

参数：

* jsonObject {Object} 要发送的数据，JSON 格式，但是发送数据的字段名，不能是配置选项中的名字。
不能是 channels、 where、 expiration_time、 expiration_interval、 push_time

返回：{Object} 返回 pushObject，可以做后续 Push 服务的方法，支持链式。

例子：

```js
pushObject.send({
    test: 123
});
```

#### pushObject.send(options)

描述：向服务器发送要推送的消息

参数：

* options {Object} 相关配置参数，其中包括：

    * data {Object} 要发送的数据，JSON 格式；

    * channels {Array}（可选）Push 的频道。默认不传，会发到所有频道；

    * where {String}（可选） 一个查询 _Installation 表的查询条件 JSON 对象

    * expiration_time {String}（可选） 消息过期的绝对日期时间

    * expiration_interval {String}（可选） 消息过期的相对时间

    * push_time {String}（可选） 定期推送时间

返回：{Object} 返回 pushObject，可以做后续 Push 服务的方法，支持链式。

例子：

```js
pushObject.send({
    data: {test: 123},
    channels: ['cctv1', 'cctv2']
});
```

#### pushObject.channel(channels, callback)

描述：增加订阅的频道

参数：

* channels {Array} 订阅的 channel 名字的数组，注意名字中不能含有横线「-」

返回：{Object} 返回 pushObject，可以做后续 Push 服务的方法，支持链式。

例子：

```js
pushObject.channel(['testChannel'], function() {
    console.log('订阅成功！');
});

// 然后你就可以直接发送消息
pushObject.send({
    data: {test: 123},
    channels: ['testChannel']
});
```

#### pushObject.unChannel(channels, callback)

描述：增加订阅的频道

参数：

* channels {Array} 订阅的 channel 名字的数组，注意名字中不能含有横线「-」

返回：{Object} 返回 pushObject，可以做后续 Push 服务的方法，支持链式。

例子：

```js
pushObject.unChannel('testChannel', function() {
    console.log('取消订阅成功！');
});

// 然后你就可以直接发送消息
pushObject.send({
    data: {test: 123},
    channels: ['testChannel']
});
```

#### pushObject.on(eventName, callback)

描述：监听当前 pushObject 内的事件，基于私有事件中心

参数：

* eventName {String} （必须）监听的事件名称

* callback 事件的回调函数，当事件被派发时触发

返回：{Object} 返回 pushObject，可以做后续 Push 服务的方法，支持链式。

例子：

```js
pushObject.on('message', function(data) {
    console.log(data);
});
```

#### pushObject.once(eventName, callback)

描述：监听当前 pushObject 内的事件，基于私有事件中心，回调只会被触发一次

参数：

* eventName {String} （必须）监听的事件名称

* callback 事件的回调函数，当事件被派发时触发

返回：{Object} 返回 pushObject，可以做后续 Push 服务的方法，支持链式。

例子：

```js
pushObject.once('open', function(data) {
    console.log(data);
});
```

#### pushObject.emit(eventName, data)

描述：派发一个事件到 pushObject 内的私有事件中心

参数：

* eventName {String} （必须）监听的事件名称

* data {Object} （可选）传递的参数，可以在监听的回调中通过第一个参数获取

返回：{Object} 返回 pushObject，可以做后续 Push 服务的方法，支持链式。

例子：

```js
pushObject.emit('customEvent', {test: 123});
```

#### pushObject.close()

描述：停止获取服务端推送消息，并且断开与服务器的连接

返回：{Object} 返回 pushObject，可以做后续 Push 服务的方法，支持链式。

例子：

```js
pushObject.close();
```

### 事件

SDK 会默认派发一些事件，这些事件仅会在 pushObject 内部被派发，您可以通过监听这些事件来完成您的操作。这些事件近在您需要接收服务端 Push 的消息时有用，如果只是推送数据给服务器，不需要使用。以下是默认事件的说明：

#### open
描述：与服务器建立好连接之后就会被派发，包括当服务断开重新被连接上时也会被触发

#### close
描述：与服务器连接断开就会被派发，包括网络中断

#### message
描述：收到服务器推送消息时会被派发，监听此事件来接收推送消息

#### reuse
描述：网络不稳定或者其他非主动与服务器断开的情况，自动重连时会派发此事件，当服务重新连接会再次派发 open 事件

#### error
描述：所有的错误处理，都会派发出一个 error 事件
