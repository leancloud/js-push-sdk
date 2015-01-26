/**
 * @author wangxiao
 * @date 2015-01-23
 *
 * 每位工程师都有保持代码优雅的义务
 * Each engineer has a duty to keep the code elegant
 */

void function(win) {

    // 当前版本
    var VERSION = '1.0.0';

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
        // 心跳时间（三分钟）
        heartbeatsTime: 3 * 60 * 1000
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
            ec: undefined
        };

        // WebSocket Open
        var wsOpen = function() {
            tool.log('WebSocket opened.');
            engine.loginPush(cache.options);
            // 启动心跳
            engine.heartbeats();
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

        engine.getId = function(options) {
            var itemName = 'LeanCloud-Push-Id-' + options.appId;
            var data = tool.storage(itemName);
            if (data && data.id) {
                return data.id;
            } else {
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
            } else {
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
                    // TODO: 后续服务端要支持，改成 javascript
                    deviceType: 'android',
                    installationId: options.id,
                    channels: options.channels
                }
            }, function(data) {
                if (data.lcError) {
                    setTimeout(function() {
                        engine.sendId(options);
                    }, 5000);
                } else {
                    if (callback) {
                        callback(data);
                    }
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
                    data: options.data
                },
                channels: options.channels
            }, function(data) {
                if (data.lcError) {
                    setTimeout(function() {
                        engine.sendPush(options, callback);
                    }, 5000);
                } else {
                    if (callback) {
                        callback(data);
                    }
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

        engine.connect = function(options) {
            var server = options.server;
            if (server && tool.now() < server.expires) {
                engine.createSocket(server.server);
            }
            else {
                new Error('WebSocket connet failed.');
                // TODO: 派发一个 Error 事件
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
                if (!data.lcError) {
                    data.expires = tool.now() + data.ttl * 1000;
                    cache.server = data;
                    callback(data);
                }
                else {
                    callback(tool.fail());
                }
            });
        };

        return {
            cache: cache,
            open: function(callback) {
                engine.getServer(cache.options, function(data) {
                    if (!data.lcError) {
                        engine.connect({
                            server: cache.server
                        });
                        cache.ec.once();
                    }
                    else {
                        callback(tool.fail());
                    }
                });
                if (callback) {
                    cache.ec.once('open', callback);
                }
                return this;
            },
            // 表示关闭当前的 session 连接和 WebSocket 连接，并且回收内存
            close: function() {
                engine.closeSession();
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
            send: function(options, callback) {
                options.appId = cache.options.appId;
                options.appKey = cache.options.appKey;
                engine.sendPush(options, callback);
                return this;
            }
        };
    };

    // 主函数，启动通信并获得 pushObject
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
            var pushObject = newPushObject();
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

    // Callback 返回的 data 中 lcError 表示失败
    tool.fail = function(obj) {
        obj = obj || {};
        obj.lcError = true;
        return obj;
    };

    // 输出 log
    tool.log = function(msg) {
        console.log(msg);
    };

    // Ajax get 请求
    tool.ajax = function(options, callback) {
        var url = options.url;
        var method = options.method || 'get';
        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        if (method === 'post') {
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
        xhr.onerror = function() {
            callback(tool.fail());
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
        } else {
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

            if (!isOnce) {
                if (!eventList[eventName]) {
                    eventList[eventName] = [];
                }
                eventList[eventName].push(fun);
            }
            else {
                if (!eventOnceList[eventName]) {
                    eventOnceList[eventName] = [];
                }
                eventOnceList[eventName].push(fun);
            }
        };

        return {
            on: function(eventName, fun) {
                _on(eventName, fun);
            },
            once: function(eventName, fun) {
                _on(eventName, fun, true);
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
            }
        };
    };

} (window);

