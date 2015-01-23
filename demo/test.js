var appId = '9p6hyhh60av3ukkni3i9z53q1l8yy3cijj6sie3cewft18vm';
var appKey = 'nhqqc1x7r7r89kp8pggrme57i374h3vyd0ukr2z3ayojpvf4';
var push1;

// 每次调用生成一个聊天实例
createNew(function(data) {
    push1 = data.push;
});

function createNew(callback) {
    push = lc.push({
        appId: appId,
        appKey: appKey
    });

    push.on('open', function() {
        callback({
            push: push
        });
    });

    push.on('close', function() {
        console.log('close');
    });

    push.on('message', function(data) {
        console.log('message');
        console.log(data);
    });
}
