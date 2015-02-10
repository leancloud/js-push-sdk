// 请换成自己的 appId 和 appKey 或者在同一文件夹下新建key.js声明全局变量appId和appKey
if(typeof appId === 'undefined'){
    var appId = '9p6hyhh60av3ukkni3i9z53q1l8yy3cijj6sie3cewft18vm';
    var appKey = 'nhqqc1x7r7r89kp8pggrme57i374h3vyd0ukr2z3ayojpvf4';
}

var push;

// 每次调用生成一个聊天实例
createNew();

function createNew() {
    // 自动注册installation(注册成安卓23333)
    push = lc.push({
        appId: appId,
        appKey: appKey
    });

    // 使用之前注册过的installationId
    //push = lc.push({
    //    appId: appId,
    //    appKey: appKey,
    //    // 替换成从控制台->存储->installation 看到的installationId. 随便找一行.
    //    installationId:'bcb544de-a45c-4e1f-a47b-7c835ef84d70'
    //});

    // 可以链式调用
    push.open(function() {
        console.log('可以接收推送');
    });

    // 监听推送消息
    push.on('message', function(data) {
        console.log('message');
        console.log(data);
    });

    // 监听网络异常
    push.on('reuse', function() {
        console.log('网络中断正在重试');
    });

    // 发送一条推送
    push.send({
        channels: ['aaa'],
        data: {wangxiao: 123}
    });

    setTimeout(function() {
        // 如果不加 channels，可以简单的使用 send 方法发送一个 json
        push.send({
            abc: 123
        });
    }, 5000);
}
