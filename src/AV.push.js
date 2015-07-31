/**
 * @author wangxiao
 * @date 2015-07-31
 *
 * 每位工程师都有保持代码优雅的义务
 * Each engineer has a duty to keep the code elegant
 */

void function(win) {

    // 当前版本
    var VERSION = '2.0.4';

    // 获取命名空间
    var AV = win.AV || {};
    win.AV = AV;

    // AMD 加载支持
    if (typeof define === 'function' && define.amd) {
        define('AV', [], function() {
            return AV;
        });
    }

    // 配置项
    var config = {
        // 心跳时间
        heartbeatsTime: 30 * 1000
    };

    // 命名空间，挂载一些工具方法
    var tool = {};

    // 命名空间，挂载私有方法
    var engine = {};

    // realtime 对象内，会被派发的全部事件名
    var eNameIndex = {
        // websocket 连接建立
        open: 'open',
        // websocket 连接关闭
        close: 'close',
        // 接受到新的推送
        message: 'message',
        // 断开重连
        reuse: 'reuse',
        // 各种错误
        error: 'error'
    };

    // 创建一个新的 realtime 对象，挂载所有 realtime 中的方法
    var newPushObject = function() {

        // 缓存一些已经实例化的变量
        var cache = {
            // 基础配置，包括 appId，appKey 等
            options: undefined,
            // WebSocket 实例
            ws: undefined,
            // 心跳的计时器
            heartbeatsTimer: undefined,
            // 事件中心
            ec: undefined,
            // 是否是用户关闭，如果不是将会断开重连
            closeFlag: false,
            // reuse 事件的重试 timer
            reuseTimer: undefined
        };

        // WebSocket Open
        var wsOpen = function() {
            tool.log('WebSocket opened.');
            engine.loginPush(cache.options);
            // 启动心跳
            engine.heartbeats();
            engine.guard();
            cache.ec.emit(eNameIndex.open);
        };

        // WebSocket Close
        var wsClose = function() {
            tool.log('WebSocket closed.');
            // 派发全局 close 事件，表示 realtime 已经关闭
            cache.ec.emit(eNameIndex.close);
        };

        // WebSocket Message
        var wsMessage = function(msg) {
            var data = JSON.parse(msg.data);
            // 派发推送事件
            if (data.cmd === 'data') {
                engine.ackPush(data.ids);
                var i;
                var l = data.msg.length;
                for (i = 0; i < l; i ++) {
                    cache.ec.emit(eNameIndex.message, data.msg[i]);
                }
            }
        };

        var wsError = function(data) {
            throw(data);
            // TODO: 增加更加详细的错误处理
        };

        // WebSocket send message
        var wsSend = function(data) {
            cache.ws.send(JSON.stringify(data));
        };

        var _channel = function(argument, callback, isRemove) {
            var channels = [];
            if (typeof argument === 'string') {
                channels.push(argument);
            }
            else {
                channels = argument;
            }
            engine.channels(channels, callback, isRemove);
        };

        engine.getId = function(options) {

            // 兼容 js sdk 与 push sdk 一起使用时，共用 installationId ，该存储地址与 JS SDK 中名字一致
            var itemName = 'AV/' + options.appId + '/installationId';
            var installationId = tool.storage(itemName);

            if (installationId) {
                return installationId;
            }
            else {
                id = tool.getId();
                options.id = id;
                engine.sendId(options, function(data) {
                    tool.storage(itemName, id);
                });
                return id;
            }
        };

        engine.sendId = function(options, callback) {
            tool.ajax({
                url: 'https://' + cache.options.host + '/1.1/installations',
                method: 'post',
                appId: options.appId,
                appKey: options.appKey,
                data: {
                    deviceType: options.deviceType,
                    installationId: options.id,
                    channels: options.channels
                }
            }, function(data) {
                if (data) {
                    if (callback) {
                        callback(data);
                        cache.ec.emit('leancloud-send-id-ok');
                    }
                }
                else {
                    setTimeout(function() {
                        engine.sendId(options);
                    }, 5000);
                }
            });
        };

        engine.sendPush = function(options, callback) {
            tool.ajax({
                url: 'https://' + cache.options.host + '/1.1/push',
                method: 'post',
                appId: options.appId,
                appKey: options.appKey,
                data: {
                    data: options.data,
                    channels: options.channels
                }
            }, function(data, error) {
                if (data) {
                    if (callback) {
                        callback(data);
                    }
                }
                else {
                    if (error.code === 403 || error.code === 404) {
                        throw(error.error);
                    } else {
                        setTimeout(function() {
                            engine.sendPush(options, callback);
                        }, 5000);
                    }
                }
            });
        };

        engine.channels = function(channels, callback, isRemove) {
            var data = {
                installationId: cache.options.id,
                deviceType: cache.options.deviceType
            };

            if (isRemove) {
                data.channels = {
                    __op: 'Remove',
                    objects: channels
                };
            }
            else {
                data.channels = channels;
            }
            tool.ajax({
                url: 'https://' + cache.options.host + '/1.1/installations',
                method: 'post',
                appId: cache.options.appId,
                appKey: cache.options.appKey,
                data: data
            }, function(data) {
                if (callback) {
                    callback(data);
                }
            });
        };

        engine.createSocket = function(server) {
            var ws = new WebSocket(server);
            cache.ws = ws;

            // TODO: 此处需要考虑 WebSocket 重用
            // TODO: 需要考虑网络状况，是用户自己主动 close websocket 还是网络问题
            ws.addEventListener('open', wsOpen);
            ws.addEventListener('close', wsClose);
            ws.addEventListener('message', wsMessage);
            ws.addEventListener('error', wsError);
        };

        // 心跳程序
        engine.heartbeats = function() {
            wsSend({});
            cache.ws.addEventListener('message', function() {
                if (cache.heartbeatsTimer) {
                    clearTimeout(cache.heartbeatsTimer);
                }
                cache.heartbeatsTimer = setTimeout(function() {
                    wsSend({});
                }, config.heartbeatsTime);
            });
        };

        // 守护进程，会派发 reuse 重连事件
        engine.guard = function() {
            cache.ec.on(eNameIndex.close, function() {
                if (!cache.closeFlag) {
                    cache.ec.emit(eNameIndex.reuse);
                }
            });
        };

        engine.connect = function(options) {
            var server = options.server;
            if (server && tool.now() < server.expires) {
                engine.createSocket(server.server);
            }
            else {
                cache.ec.emit(eNameIndex.error);
                throw('WebSocket connet failed.');
            }
        };

        engine.ackPush = function(idList) {
            wsSend({
                cmd: 'ack',
                appId: cache.options.appId,
                installationId: cache.options.id,
                ids: idList
            });
        };

        engine.loginPush = function(options) {
            wsSend({
                cmd: 'login',
                appId: options.appId,
                installationId: options.id
            });
        };

        engine.getServer = function(options, callback) {
            var appId = options.appId;
            // 是否获取 wss 的安全链接
            var secure = options.secure;
            var url = '';
            var protocol = 'http://';
            if (win && win.location.protocol === 'https:') {
                protocol = 'https://';
            }
            var node = '';
            switch (options.region) {
                case 'cn':
                    node = 'g0';
                break;
                case 'us':
                    node = 'a0';
                break;
                default:
                    throw('There is no this region.');
            }
            url = protocol + 'router-' + node + '-push.leancloud.cn/v1/route?appId=' + appId ;
            if (secure) {
              url += '&secure=1';
            }
            tool.ajax({
                url: url
            }, function(data, error) {
                if (data) {
                    data.expires = tool.now() + data.ttl * 1000;
                    cache.server = data;
                    callback(data);
                }
                else {
                    if (error.code === 403 || error.code === 404) {
                        throw(error.error);
                    } else {
                        cache.ec.emit(eNameIndex.error);
                    }
                }
            });
        };

        return {
            installationId: '',
            cache: cache,
            open: function(callback) {
                var me = this;
                engine.getServer(cache.options, function(data) {
                    if (data) {
                        engine.connect({
                            server: cache.server
                        });
                    }
                });
                if (callback) {
                    cache.ec.on(eNameIndex.open, callback);
                }
                // 断开重连
                cache.ec.once(eNameIndex.reuse + ' ' + eNameIndex.error, function() {
                    if (cache.reuseTimer) {
                        clearTimeout(cache.reuseTimer);
                    }
                    cache.reuseTimer = setTimeout(function() {
                        me.open();
                    }, 5000);
                });
                return this;
            },
            // 表示关闭 WebSocket 连接，并且回收内存
            close: function() {
                cache.closeFlag = true;
                cache.ws.close();
                return this;
            },
            on: function(eventName, callback) {
                cache.ec.on(eventName, callback);
                return this;
            },
            once: function(eventName, callback) {
                cache.ec.once(eventName, callback);
                return this;
            },
            off: function(eventName, fun) {
                cache.ec.off(eventName, fun);
                return this;
            },
            emit: function(eventName, data) {
                cache.ec.emit(eventName, data);
                return this;
            },
            send: function(argument, callback) {
                var obj = {
                    appId: cache.options.appId,
                    appKey: cache.options.appKey
                };
                if (!argument.channels &&
                    !argument.where &&
                    !argument.expiration_time &&
                    !argument.expiration_interval &&
                    !argument.push_time) {

                    obj.data = argument;
                    engine.sendPush(obj, callback);
                }
                else {
                    for (var k in argument) {
                        obj[k] = argument[k];
                    }
                    engine.sendPush(obj, callback);
                }
                return this;
            },
            // 订阅频道
            subscribe: function(argument, callback) {
                _channel(argument, callback);
                return this;
            },
            // 取消订阅
            unsubscribe: function(argument, callback) {
                _channel(argument, callback, true);
                return this;
            },
            // 接受消息
            receive: function(callback) {
                if (!callback) {
                    throw('Receive must hava callback.');
                }
                cache.ec.on(eNameIndex.message, function(data) {
                    callback(data);
                });
                return this;
            }
        };
    };

    // 主函数，启动通信并获得 pushObject
    // 因为只有需要接收 Push 的时候才需要开启服务器连接，所以这个方法没有 callback
    AV.push = function(options) {
        if (typeof options !== 'object') {
            throw('AV.push need a argument at least.');
        }
        else if (!options.appId) {
            throw('Options must have appId.');
        }
        else if (!options.appKey) {
            throw('Options must have appKey.');
        }
        else {

            // 通过判断插件库中的对象是否存在来检测是否需要关掉安全链接，在需要兼容 flash 的时候需要关掉，默认开启。
            var secure = win.WebSocket.loadFlashPolicyFile ? false : true;

            options = {
                // LeanCloud 中唯一的服务 id
                appId: options.appId,
                // LeanCloud 中检测客户端权限的 key
                appKey: options.appKey,
                // clientId 对应的就是 peerId，如果不传入服务器会自动生成，客户端没有持久化该数据。
                peerId: options.clientId,
                // 是否关闭 WebSocket 的安全链接，即由 wss 协议转为 ws 协议，关闭 SSL 保护。默认开启。
                secure: typeof(options.secure) === 'undefined' ? secure : options.secure,
                // 服务器地区选项，默认为中国大陆
                region: options.region || 'cn',
                // 推送的频道
                channels: options.channels || [],
                // 服务端用来记录和区分 SDK 的字段
                deviceType: 'web'
            };

            switch(options.region) {
                case 'cn':
                    options.host = 'leancloud.cn';
                break;
                case 'us':
                    options.host = 'avoscloud.us';
                break;
            }

            var pushObject = newPushObject();
            pushObject.cache.options = options;
            // 这个 id 是针对设备的抽象
            options.id = engine.getId(options);
            // 暴露 installationId
            pushObject.installationId = options.id;
            pushObject.cache.ec = tool.eventCenter();
            return pushObject;
        }
    };

    // 赋值版本号
    AV.push.version = VERSION;

    // 挂载私有方法
    AV.push._tool = tool;
    AV.push._engine = engine;

    // 空函数
    tool.noop = function() {};

    // 获取一个唯一 id，碰撞概率：基本不可能
    tool.getId = function() {
        // 与时间相关的随机引子
        var getIdItem = function() {
            return Date.now().toString(36) + Math.random().toString(36).substring(2, 3);
        };
        return 'AV-' + getIdItem() + '-' + getIdItem() + '-' + getIdItem();
    };

    // 输出 log
    tool.log = function(msg) {
        console.log(msg);
    };

    tool.ajax = function(options, callback) {
        var url = options.url;
        var method = options.method || 'get';
        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        if (method === 'post' || method === 'put') {
            xhr.setRequestHeader('Content-Type', 'application/json');
        }
        if (options.appId) {
            xhr.setRequestHeader('X-AVOSCloud-Application-Id', options.appId);
        }
        if (options.appKey) {
            xhr.setRequestHeader('X-AVOSCloud-Application-Key', options.appKey);
        }

        // IE9 中需要设置所有的 xhr 事件回调，不然可能会无法执行后续操作
        xhr.onprogress = function(){};
        xhr.ontimeout = function(){};
        xhr.timeout = 0;

        xhr.onload = function(data) {
            // 检测认为 2xx 的返回都是成功
            if (xhr.status >= 200 && xhr.status < 300) {
                callback(JSON.parse(xhr.responseText));
            } else {
                callback(null, JSON.parse(xhr.responseText));
            }
        };
        xhr.onerror = function(data) {
            callback(null, data);
            throw('Network error.');
        };
        xhr.send(JSON.stringify(options.data));
    };

    // 获取当前时间的时间戳
    tool.now = function() {
        return Date.now();
    };

    // 储存
    tool.storage = function(name, value) {
        if (value) {
            if (typeof value === 'object') {
                value = JSON.stringify(value);
            }
            win.localStorage.setItem(name, value);
        }
        else {
            var result = win.localStorage.getItem(name);
            if (/^[\{|\[]/.test(result) && /[\}|\]]$/.test(result)) {
                result = JSON.parse(result);
            }
            return result;
        }
    };

    // 小型的私有事件中心
    tool.eventCenter = function() {
        var eventList = {};
        var eventOnceList = {};

        var _on = function(eventName, fun, isOnce) {
            if (!eventName) {
                throw('No event name.');
            }
            else if (!fun) {
                throw('No callback function.');
            }
            var list = eventName.split(/\s+/);
            var tempList;
            if (!isOnce) {
                tempList = eventList;
            }
            else {
                tempList = eventOnceList;
            }
            for (var i = 0, l = list.length; i < l; i ++) {
                if (list[i]) {
                    if (!tempList[list[i]]) {
                        tempList[list[i]] = [];
                    }
                    tempList[list[i]].push(fun);
                }
            }
        };

        var _off = function(eventName, fun, isOnce) {
            var tempList;
            if (!isOnce) {
                tempList = eventList;
            } else {
                tempList = eventOnceList;
            }
            if (tempList[eventName]) {
                var i = 0;
                var l = tempList[eventName].length;
                for (; i < l; i ++) {
                    if (tempList[eventName][i] === fun) {
                        tempList[eventName][i] = null;
                        // 每次只清除一个相同事件绑定
                        return;
                    }
                }
            }
        };

        function cleanNull(list) {
            var tempList = [];
            var i = 0;
            var l = list.length;
            if (l) {
                for (; i < l; i ++) {
                    if (list[i]) {
                        tempList.push(list[i]);
                    }
                }
                return tempList;
            } else {
                return null;
            }
        }

        return {
            on: function(eventName, fun) {
                _on(eventName, fun);
                return this;
            },
            once: function(eventName, fun) {
                _on(eventName, fun, true);
                return this;
            },
            emit: function(eventName, data) {
                if (!eventName) {
                    throw('No emit event name.');
                }
                var i = 0;
                var l = 0;
                if (eventList[eventName]) {
                    i = 0;
                    l = eventList[eventName].length;
                    for (; i < l; i ++) {
                        if (eventList[eventName][i]) {
                            eventList[eventName][i].call(this, data);
                        }
                    }
                    eventList[eventName] = cleanNull(eventList[eventName]);
                }
                if (eventOnceList[eventName]) {
                    i = 0;
                    l = eventOnceList[eventName].length;
                    for (; i < l; i ++) {
                        if (eventOnceList[eventName][i]) {
                            eventOnceList[eventName][i].call(this, data);
                            _off(eventName, eventOnceList[eventName][i], true);
                        }
                    }
                    eventOnceList[eventName] = cleanNull(eventOnceList[eventName]);
                }
                return this;
            },
            off: function(eventName, fun) {
                _off(eventName, fun);
                return this;
            }
        };
    };

} (window);
