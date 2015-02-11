/**
 * @author wangxiao
 * @date 2015-01-23
 *
 * 每位工程师都有保持代码优雅的义务
 * Each engineer has a duty to keep the code elegant
 */

void function(win) {

    // 当前版本
    var VERSION = '2.0.0';

    // 获取命名空间
    var lc = win.lc || {};
    win.lc = lc;
    // 历史遗留，同时获取 av 命名空间
    // win.av = win.av || lc;

    // AMD 加载支持
    if (typeof define === 'function' && define.amd) {
        define('lc', [], function() {
            return lc;
        });
    }

    // 配置项
    var config = {
        // 心跳时间（一分钟）
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
            new Error(data);
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
            var itemName = 'LeanCloud-Push-Id-' + options.appId;
            var data = tool.storage(itemName);
            if (data && data.id) {
                return data.id;
            } 
            else {
                id = tool.getId();
                options.id = id;
                engine.sendId(options, function(data) {
                    tool.storage(itemName, {
                        id: id,
                        objectId: data.objectId
                    });
                });
                return id;
            }
        };

        engine.getObjectId = function(options) {
            var itemName = 'LeanCloud-Push-Id-' + options.appId;
            var value = tool.storage(itemName);
            if (value) {
                return value.objectId;
            } 
            else {
                return null;
            }
        };

        engine.sendId = function(options, callback) {
            tool.ajax({
                url: 'https://leancloud.cn/1.1/installations',
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
                url: 'https://leancloud.cn/1.1/push',
                method: 'post',
                appId: options.appId,
                appKey: options.appKey,
                data: {
                    data: options.data,
                    channels: options.channels
                }
            }, function(data) {
                if (data) {
                    if (callback) {
                        callback(null, data);
                    }
                } 
                else {
                    setTimeout(function() {
                        engine.sendPush(options, callback);
                    }, 5000);
                }
            });
        };

        engine.channels = function(channels, callback, isRemove) {
            var objectId = engine.getObjectId(cache.options);
            var data = {
                installationId: cache.options.id,
                deviceType: cache.options.deviceType
            };
            if (objectId) {
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
                    url: 'https://leancloud.cn/1.1/installations/' + objectId,
                    method: 'put',
                    appId: cache.options.appId,
                    appKey: cache.options.appKey,
                    data: data
                }, function(data) {
                    if (callback) {
                        callback(data);
                    }
                });
            } 
            else {
                cache.ec.once('leancloud-send-id-ok', function() {
                    engine.channels(channels, callback, isRemove);
                });
            }
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
                new Error('WebSocket connet failed.');
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
            var secure = options.secure || true;
            var url = '';
            var protocol = 'http://';
            if (win && win.location.protocol === 'https:') {
                protocol = 'https://';
            }
            url = protocol + 'router-g0-push.avoscloud.com/v1/route?appId=' + appId ;
            if (secure) {
              url += '&secure=1';
            }
            tool.ajax({
                url: url
            }, function(data) {
                if (data) {
                    data.expires = tool.now() + data.ttl * 1000;
                    cache.server = data;
                    callback(data);
                } 
                else {
                    cache.ec.emit(eNameIndex.error);
                }
            });
        };

        return {
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
                    obj.data = argument.data;
                    obj.channels = argument.channels;
                    engine.sendPush(obj, callback);
                }
                return this;
            },
            // 订阅频道
            channel: function(argument, callback) {
                _channel(argument, callback);
                return this;
            },
            // 取消订阅
            unChannel: function(argument, callback) {
                _channel(argument, callback, true);
                return this;
            }
        };
    };

    // 主函数，启动通信并获得 pushObject
    // 因为只有需要接收 Push 的时候才需要开启服务器连接，所以这个方法没有 callback
    lc.push = function(options) {
        if (typeof options !== 'object') {
            new Error('lc.push need a argument at least.');
        }
        else if (!options.appId) {
            new Error('Options must have appId.');
        }
        else if (!options.appKey) {
            new Error('Options must have appKey.');
        }
        else {
            options.channels = options.channels || [];
            var pushObject = newPushObject();
            // TODO: 后续服务端要支持，改成 javascript
            options.deviceType = 'android';
            // 这个 id 是针对设备的抽象
            options.id = engine.getId(options);
            pushObject.cache.options = options;
            pushObject.cache.ec = tool.eventCenter();
            return pushObject;
        }
    };

    // 赋值版本号
    lc.push.version = VERSION;

    // 挂载私有方法
    lc.push._tool = tool;
    lc.push._engine = engine;

    // 空函数
    tool.noop = function() {};

    // 获取一个唯一 id, 碰撞概率同一毫秒小于万分之一
    tool.getId = function() {
        return 'lc' + (Date.now().toString(36) + Math.random().toString(36).substring(2, 3));
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
        xhr.onload = function() {
            callback(JSON.parse(xhr.responseText));
        };
        xhr.onerror = function(data) {
            callback(null, data);
            new Error('Network error.');
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
                new Error('No event name.');
            }
            else if (!fun) {
                new Error('No callback function.');
            }
            var list = eventName.split(/\s+/);
            for (var i = 0, l = list.length; i < l; i ++) {
                if (list[i]) {
                    if (!isOnce) {
                        if (!eventList[list[i]]) {
                            eventList[list[i]] = [];
                        }
                        eventList[list[i]].push(fun);
                    }
                    else {
                        if (!eventOnceList[list[i]]) {
                            eventOnceList[list[i]] = [];
                        }
                        eventOnceList[list[i]].push(fun);
                    }
                }
            }
        };

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
                    new Error('No emit event name.');
                }
                var i = 0;
                var l = 0;
                if (eventList[eventName]) {
                    i = 0;
                    l = eventList[eventName].length;
                    for (; i < l; i ++) {
                        // 有可能执行过程中，删除了某个事件对应的方法
                        if (l > eventList[eventName].length) {
                            i --;
                            l = eventList[eventName].length;
                        }
                        eventList[eventName][i].call(this, data);
                    }
                }
                if (eventOnceList[eventName]) {
                    i = 0;
                    l = eventOnceList[eventName].length;
                    for (; i < l; i ++) {
                        // 有可能执行过程中，删除了某个事件对应的方法
                        if (l > eventOnceList[eventName].length) {
                            i --;
                            l = eventOnceList[eventName].length;
                        }
                        eventOnceList[eventName][i].call(this, data);
                    }
                }
                return this;
            },
            remove: function(eventName, fun) {
                if (eventList[eventName]) {
                    var i = 0;
                    var l = eventList[eventName].length;
                    for (; i < l; i ++) {
                        if (eventList[eventName][i] === fun) {
                            eventList[eventName].splice(i, 1);
                        }
                    }
                }
                return this;
            }
        };
    };

} (window);

