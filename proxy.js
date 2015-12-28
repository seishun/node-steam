var socks = require('socksv5');

var srv = socks.createServer(function (info, accept, deny) {
    console.log('info', info);
    accept();
});
srv.listen(1080, '127.0.0.1', function () {
    console.log('SOCKS server listening on port 1080');
});

srv.useAuth(socks.auth.None());