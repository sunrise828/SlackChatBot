var siChatStarted = "";
$(function () {
    "use strict";

    var chatContent = $('#chatContent');
    var input = $('#message');
    var status = $('#status');
    var msgType = "visitor";
    var lastMessageBy = "";
    var lastTime = 0;
    var chatStatus = ''; // 'not-started', 'queued', 'started', 'finished'
    var agentTypingTimer = null;

    var chatUrl = chatwidget_vars.chatUrl;
    var wid = chatwidget_vars.wid;
    var author = chatwidget_vars.defaultVisitorText;
    var currentPage = chatwidget_vars.cp;
    var invalidEmailMessage = chatwidget_vars.invalidEmailMessage;
    var genericError = chatwidget_vars.genericError;
    var endMessage = chatwidget_vars.endMessage;
    var timeoutMessage = chatwidget_vars.timeoutMessage;
    var timeoutSeconds = chatwidget_vars.timeoutSeconds;
    var startNewMessage = chatwidget_vars.startNewMessage;
    var waitingMessage = chatwidget_vars.waitingMessage;
    var widgetTitle = chatwidget_vars.widgetTitle;
    var userId = null;
    var isCWActive = true;
    var sessionId = "";
    var socket = null;
    try {
        sessionId = localStorage.getItem("rtp_chatsid_" + wid);
        if (!sessionId || sessionId.length === 0) {
            sessionId = guid();
            localStorage.setItem("rtp_chatsid_" + wid, sessionId);
            localStorage.setItem("rtp_refresh_" + wid, 0);
            chatStatus = localStorage.getItem("rtp_chatstatus_" + wid);
            if (!chatStatus || chatStatus.length === 0) {
                chatStatus = "not-started";
                localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            }
        } else {
            chatStatus = localStorage.getItem("rtp_chatstatus_" + wid);
        }
    } catch (err) {
        sessionId = guid();
    }

    init();
    renderPans();

    function renderPans() {
        $('button .loader').addClass('loaded');
        if (chatStatus == 'not-support') {
            $('.no-support').show();
            $('#wrapper').hide();
            $('#message-area').hide();
            $('#form-presales').show();
            $('.siButtonActionClose-chat').hide();
        } else if (chatStatus != 'not-started') {
            newSubscribe();
            $('#form-presales').hide();
            $('.siButtonActionClose-chat').show();
            $('#form-chat-wrap').show();
            if (chatStatus != 'finished')
                $('#message-area').show();

            $('#form-chat').show();
            $('#textarea').css({
                'display': 'table-row'
            });

            if (!/iPhone|iPod|Android/.test(window.navigator.userAgent)) {
                $('#message').focus();
            } else if (/iPhone|iPod/.test(window.navigator.userAgent)) {
                $('#message').addClass('message_ios');
            }
            loadEmoji();
        }        
    }

    function init() {
        if (chatStatus != 'not-started') {
            socket = io(chatUrl);
            socketInit();
        }
        parent.postMessage(chatStatus == 'not-started' ? 'siNew' : 'siRefresh', '*');
        var siName = localStorage.getItem("rtp_name");
        if (siName && siName.length > 0) { $("#name").val(siName); }
        var siEmail = localStorage.getItem("rtp_email");
        if (siEmail && siEmail.length > 0) { $("#email").val(siEmail); }
        $('.slim-scroll').slimScroll({
            height: (window.innerHeight || chatwidget_vars.widgetHeight) - 120 + 'px',
            railVisible: true,
            start: 'bottom'
        });

        $('.silc-btn-button-close').click(function (e) {
            e.preventDefault();
            e.stopPropagation();
            $('#form-chat-wrap').hide();
            $('#message-area').hide();
            $('#form-chat').hide();
            $('#form-close-chat').show();
        });
        if (window.self === window.top) {
            var $viewportMeta = $('meta[name="viewport"]');
            $('input, select, textarea').bind('focus blur', function (event) {
                $viewportMeta.attr('content', 'width=device-width,initial-scale=1,maximum-scale=' + (event.type == 'blur' ? 10 : 1));
            });
        }
    }

    // first login window
    $('#preSalesStart').click(function (event) {
        var name = $('#name').val();
        var email = $('#email').val();
        sessionId = guid();
        localStorage.setItem("rtp_name", name);
        localStorage.setItem("rtp_email", email);
        localStorage.setItem("rtp_chatsid_" + wid, sessionId);
        var vname = true;
        var vemail = true;
        if ($('#name').is(":visible") && name.length === 0) vname = false;
        if ($('#email').is(":visible") && email.length === 0) vemail = false;
        if ($('#email').is(":visible") && !validEmail(email)) vemail = false;

        if (invalidEmailMessage.length === 0) vemail = true;
        if (genericError.length === 0) {
            vname = true;
            vphone = true;
        }

        if (vname && vemail) {
            $('button .loader').removeClass('loaded');
            $('.siButtonActionClose-chat').show();
            const param = {
                author: author,
                wid: wid,
                sessionId: sessionId,
                currentPage: currentPage,
                name: name,
                email: email,
                status: chatStatus,
                refresh: 0
            };
            if (socket) {
                socket.emit('User:Arrived', param);
            } else {
                socket = io(chatUrl);
                socketInit();
                socket.emit('User:Arrived', param);
            }
        } else {
            if ($('#email').is(":visible") && !validEmail(email)) {
                $('#errorMsg').html("<p class='operator' style='color:red;text-align:center'>" + invalidEmailMessage + "</p>");
                $('#buffer').css('padding-top', '30px');
            } else {
                $('#errorMsg').html("<p class='operator' style='color:red;text-align:center'>" + genericError + "</p>");
                $('#buffer').css('padding-top', '30px');
            }
        }
    });

    function showMainPage() {
        $('button .loader').addClass('loaded');
        $('#form-presales').hide();
        $("#chatContent").html('');
        $('#form-chat-wrap').show();
        $('#message-area').show();
        $('#form-chat').show();
        $('.siButtonActionClose-chat').show();
        $('#textarea').css({
            'display': 'table-row'
        });

        $('#body').css({
            'height': '251px;'
        });
        if (!/iPhone|iPod|Android/.test(window.navigator.userAgent)) {
            $('#message').focus();
        } else if (/iPhone|iPod/.test(window.navigator.userAgent)) {

        }
        loadEmoji();
    }

    function loadEmoji() {
        if (!/iPhone|iPod|Android/.test(window.navigator.userAgent)) {
            $("#btnEmoji").show();
            $("#btnSendHref").show();
        }
    };

    function onMessage(response) {
        var json = response;
        var date = typeof (json.event_ts) == 'string' ? parseInt(json.event_ts) : json.event_ts;
        if (json.status == 'aTyping') {
            $('#typingIndicator').removeClass('hide');
            clearAgentTyping();
            if (!agentTypingTimer) {
                agentTypingTimer = setTimeout(function () {
                    $('#typingIndicator').addClass('hide');
                }, 5000);
            }
        } else if (json.message && json.message.length > 0) {
            $('#typingIndicator').addClass('hide');
            clearAgentTyping();
            if (json.domain == 'slack') {
                var ap = '/images/material-person-white.png';
                addMessage(json.author, json.message, new Date(date), json.type, ap, json.chatStatus);
                if (!isCWActive)
                    play_sound();
            } else {
                lastMessageBy = json.author;
                addMessage(json.author, json.message, new Date(date), msgType, '', chatStatus);
            }
        }
    };

    $('#render_try').click(function () {
        chatStatus = 'not-started';
        localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
        $('button .loader').addClass('loaded');
        $('#title-text').html(widgetTitle);
        $('.no-support').hide();
        $('#wrapper').show();
        $('#form-presales').show();
        $('.siButtonActionClose-chat').hide();
        $('#form-chat-wrap').hide();
    });

    // socket init
    function socketInit() {
        socket.on('Room:Created', function (data) {
            $('.container-fluid.loader').show();
            if (data.ticket) {
                $('#title-text').html(chatwidget_vars.widgetTitle + `(#T-${data.ticket})`);
            }
            chatStatus = 'started';
            localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            userId = data.id;
            socket.emit('Joined:Room');
            showMainPage();
        });

        socket.on('Message', function (data) {
            onMessage(data);
        });

        socket.on('NoSupport', function () {
            chatStatus = 'not-support';
            localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            renderPans();
        });

        socket.on('Ticket:Create', function (event) {
            $('#title-text').html(chatwidget_vars.widgetTitle + `(#T-${event.ticket})`);
        })

        socket.on('Histories', function (event) {
            $('.container-fluid.loader').hide();            
            $('button .loader').removeClass('loaded');
            $('.siButtonActionClose-chat').show();
            chatContent.html('');
            if (event.ticket) {
                $('#title-text').html(chatwidget_vars.widgetTitle + `(#T-${event.ticket})`);
            }
            if (event.msgs.length > 0) {
                event.msgs.forEach(msg => {
                    if (msg.domain == 'slack') {
                        addMessage('Support Man', msg.text, new Date(msg.createdAt),
                            '', '/images/material-person-white.png', 'queue');
                    } else {
                        var myMsg = {
                            time: new Date(msg.createdAt).getTime(),
                            author: author,
                            message: msg.text,
                            chatStatus: 'queue',
                            type: msgType,
                            wid: wid,
                            sessionId: sessionId,
                            currentPage: currentPage,
                            name: localStorage.getItem("rtp_name"),
                            email: localStorage.getItem("rtp_email"),
                            agentPhoto: ''
                        };
                        pushl(myMsg);
                    }
                })
            }

            if (event.status == 'finished') {
                addMessage('System', "This conversation is finished. Please open new!", new Date(),
                    '', '/images/logo-white.png', 'close');
                chatClosed();
                $('.siButtonActionClose-chat').show();
            } else if (event.status == 'history') {
                chatStatus = 'started';
                localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            }
        })

        socket.on('Error', function (event) {
            if (event.reason == 'wrong_workspace_id' && event.sessionId == sessionId) {
                chatStatus = 'not-started';
                localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
                const error = 'You have a wrong workspace id now.\n Please contact our support!';
                $('#errorMsg').html("<p class='operator' style='color:red;text-align:center'>" + error + "</p>");
                $('#buffer').css('padding-top', '30px');
            } else if (event.reason == 'not_support' && event.sessionId == sessionId) {
                localStorage.clear();
                chatStatus = 'not-support';
                localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            } else if (event.reason == 'not_support' && event.sessionId == sessionId) {
                chatStatus = 'not-started';
                localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            }
            renderPans();
        })

        socket.on('2MinAlert', function () {
            const message = "We haven't here from you in some time. Are you still with us?\n"
                + "Please respond if you are still there";

            addMessage('System', message, new Date(), 'admin', './images/logo-white.png', '2minAlert');
        });

        socket.on('3MinAlert', function () {
            const message = "We are going to have to end this chat if we don't hear from you."
                + "We will have to end this chat in 1 minute.";
            addMessage('System', message, new Date(), 'admin', './images/logo-white.png', '3minAlert');
        });

        socket.on('4MinAlert', function () {
            const message = "Thanks for using our system. This chat is timeout.";
            + "We will have to end this chat in 1 minute.";
            addMessage('System', message, new Date(), 'admin', './images/logo-white.png', '4minAlert');
            // socket.emit('Finished', {status: 'finished'});
            chatStatus = "finished";
            localStorage.setItem('rtp_chatstatus_' + wid, chatStatus);
            chatClosed();
        });

        socket.on('Finished', function (event) {
            chatStatus = 'not-started';
            localStorage.setItem('rtp_chatstatus_' + wid, chatStatus);
            socket.disconnect();
            socket = null;
            $('#form-close-chat').hide()
            $('#form-presales').show();
            $('#form-chat-wrap').hide();
            $('#message-area').hide();
            $('#form-chat').hide();
            $('#title-text').html(widgetTitle);
            $('button .loader').addClass('loaded');
        });
    };

    input.keydown(function (e) {
        if (e.keyCode === 13) {
            e.preventDefault();
            var msg = $(this).val();
            if (msg.length > 0) {
                var ctime = new Date().getTime();
                var msg = {
                    time: ctime,
                    author: author,
                    message: msg,
                    chatStatus: chatStatus,
                    type: msgType,
                    wid: wid,
                    sessionId: sessionId,
                    currentPage: currentPage,
                    name: localStorage.getItem("rtp_name"),
                    email: localStorage.getItem("rtp_email")
                };
                // pushl(msg);
                socket.emit('Message', msg);
            }
            $(this).val('').focus();
            try {
                $('.msgArea').emojiPicker('hide');
            } catch (err) { }
        } else {
            socket.emit('Typing');
        }
    });

    function setTyping() {
        clearTyping();
        typing = true;
    }

    function clearTyping() {
        // clearTimeout(window.typingTimer)
        // window.typingTimer = null;
    }

    function clearAgentTyping() {
        if (agentTypingTimer) {
            clearTimeout(agentTypingTimer)
            agentTypingTimer = null;
        }
    }

    function newSubscribe() {
        $('.container-fluid.loader').show();
        var siName = localStorage.getItem("rtp_name");
        var siEmail = localStorage.getItem("rtp_email");
        var siRefresh = localStorage.getItem("rtp_refresh_" + wid);
        socket.emit('User:Arrived', {
            wid: wid,
            sessionId: sessionId,
            currentPage: currentPage,
            name: siName,
            email: siEmail,
            status: chatStatus,
            refresh: siRefresh
        });
    }
    $('#btn-close-chat').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log(chatStatus);
        socket.emit('Finished', { status: 'closed' });
        chatStatus = 'not-started';
        localStorage.setItem('rtp_chatstatus_' + wid, chatStatus);
        socket.disconnect();
        socket = null;
        $('#form-close-chat').hide()
        $('#form-presales').show();
        $('#form-chat-wrap').hide();
        $('#message-area').hide();
        $('#form-chat').hide();
        $('#title-text').html(widgetTitle);
        $('.siButtonActionClose-chat').hide();
        $('button .loader').addClass('loaded');

    });

    $('#btn-continue-chat').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        // chatStatus = 'queue';
        $('#form-chat-wrap').show();
        if (chatStatus == 'not-started' || chatStatus == 'close') {
            $('#message-area').hide();
        } else {
            $('#message-area').show();
        }

        $('#form-chat').show();
        $('#form-close-chat').hide();
    })

    $('.silc-btn-button-minimize').click(function (e) {
        e.preventDefault();
        e.stopPropagation();

        // if ($('#form-offline-sent').is(":visible")) {
        //     $('#form-close-chat').hide();
        // } else {
        //     $('#form-chat-wrap').show();
        //     $('#message-area').show();
        //     $('#form-chat').show();
        //     $('#form-close-chat').hide();
        // }
        parent.postMessage("siCloseWindow", "*");

    });

    $('.silc-btn-button-close').click(function (e) {
        if ("not-started" !== chatStatus) {
            e.preventDefault();
            e.stopPropagation();
            $('#form-chat-wrap').hide();
            $('#message-area').hide();
            $('#form-chat').hide();
            $('#form-close-chat').show();
        }

    });

    function chatClosed() {
        $('#form-chat-wrap').show();
        $('#form-chat').show();
        $('#message-area').hide();
        $('#form-close-chat').hide();        
    }

    function addMessage(author, message, datetime, msgType, agentPhoto, chatStatus) {
        var time = (datetime.getHours() < 10 ? '0' + datetime.getHours() : datetime.getHours()) + ':' +
            (datetime.getMinutes() < 10 ? '0' + datetime.getMinutes() : datetime.getMinutes());

        message = replaceAll(message, "&amp;", "&");
        message = replaceAll(message, "&lt;", "<");
        message = replaceAll(message, "&gt;", ">");
        message = replaceAll(message, "&quot;", "\"");
        message = replaceAll(message, "&#39;", "'");
        message = replaceAll(message, "&#61;", "=");
        message = replaceAll(message, "&#43;", "+");
        message = replaceAll(message, "&#34;", "\"");

        message = emoji.replace_unified(message);
        message = emoji.replace_colons(message);

        if (message.indexOf('<a href') < 0 && message.indexOf('<i>') < 0 &&
            message.indexOf('<img ') < 0 && message.indexOf('<b>') < 0) {
            message = replaceAll(message, "<", "&lt;");
            message = replaceAll(message, ">", "&gt;");
        }

        if (lastMessageBy !== author && author.length > 0) {
            lastMessageBy = author;
            if ('visitor' == msgType) {
                var msg = '<div class="sic-block sic-block-user sic-block-last"><div class="si-comment-wrapper si-comment-wrapper-user"><div class="si-comment"><div class="si-blocks"><div class="si-block si-block-paragraph">'
                msg += message;
                msg += '</div></div></div></div></div>';
                chatContent.append(msg);
            } else {
                if (chatStatus == "closed") {
                    var msg = '<div class="sic-block sic-block-admin"><div class="si-comment-wrapper si-comment-wrapper-admin"><div class="si-comment-wrapper-admin-img"><div class="si-img"><img data-name="' + widgetTitle + '" class="initials img-circle"/></div></div><div class="si-comment"><div class="si-blocks"><div class="si-block si-block-paragraph">'
                    msg += message;
                    msg += '</div></div></div></div><span></span></div>';
                    chatContent.append(msg);

                } else if (chatStatus == "timeout") {
                    var msg = '<div class="sic-block sic-block-admin"><div class="si-comment-wrapper si-comment-wrapper-admin"><div class="si-comment-wrapper-admin-img"><div class="si-img"><img data-name="' + widgetTitle + '" class="initials img-circle"/></div></div><div class="si-comment"><div class="si-blocks"><div class="si-block si-block-paragraph">'
                    msg += message;
                    msg += '</div></div></div></div><span></span></div>';
                    chatContent.append(msg);
                } else {
                    var msg = '<div class="sic-block sic-block-admin"><div class="si-comment-wrapper si-comment-wrapper-admin">';
                    if (author && author != '') {
                        msg += '<div class="si-comment-wrapper-admin-name">' + author + '</div>';
                    }
                    msg += '<div class="si-comment-wrapper-admin-img"><div class="si-img"><img src="' + agentPhoto + '"></div></div><div class="si-comment"><div class="si-blocks"><div class="si-block si-block-paragraph">'
                    msg += message;
                    msg += '</div></div></div></div><span></span></div>';
                    chatContent.append(msg);
                }

            }

        } else {
            if ('visitor' == msgType) {
                var msg = '<div class="sic-block sic-block-user sic-block-last"><div class="si-comment-wrapper si-comment-wrapper-user"><div class="si-comment"><div class="si-blocks"><div class="si-block si-block-paragraph">'
                msg += message;
                msg += '</div></div></div></div></div>';
                chatContent.append(msg);
            } else {
                if (chatStatus == "closed") {
                    var msg = '<div class="sic-block sic-block-admin"><div class="si-comment-wrapper si-comment-wrapper-admin"><div class="si-comment-wrapper-admin-img"><div class="si-img"><img data-name="' + widgetTitle + '" class="initials img-circle"/></div></div><div class="si-comment"><div class="si-blocks"><div class="si-block si-block-paragraph">'
                    msg += message;
                    msg += '</div></div></div></div><span></span></div>';
                    chatContent.append(msg);

                } else if (chatStatus == "timeout") {
                    var msg = '<div class="sic-block sic-block-admin"><div class="si-comment-wrapper si-comment-wrapper-admin"><div class="si-comment-wrapper-admin-img"><div class="si-img"><img data-name="' + widgetTitle + '" class="initials img-circle"/></div></div><div class="si-comment"><div class="si-blocks"><div class="si-block si-block-paragraph">'
                    msg += message;
                    msg += '</div></div></div></div><span></span></div>';
                    chatContent.append(msg);
                } else {
                    var msg = '<div class="sic-block sic-block-admin"><div class="si-comment-wrapper si-comment-wrapper-admin"><div class="si-comment-wrapper-admin-img"><div class="si-img"><img src="' + agentPhoto + '"></div></div><div class="si-comment"><div class="si-blocks"><div class="si-block si-block-paragraph">'
                    msg += message;
                    msg += '</div></div></div></div><span></span></div>';
                    chatContent.append(msg);
                }
            }
            //chatContent.append('<p class="msg-text">'+message+'</p>');
        }
        var scrollTo_val = $('#form-chat').prop('scrollHeight') + 'px';
        $('#form-chat').slimScroll({
            scrollTo: scrollTo_val
        });
    }

    function escapeRegExp(str) {
        return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    function replaceAll(str, find, replace) {
        return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
    }

    function addPushMessages(message) {
        message = replaceAll(message, "&amp;", "&");
        message = replaceAll(message, "&lt;", "<");
        message = replaceAll(message, "&gt;", ">");
        message = replaceAll(message, "&quot;", "\"");
        message = replaceAll(message, "&#39;", "'");
        message = replaceAll(message, "&#61;", "=");
        message = replaceAll(message, "&#43;", "+");

        message = emoji.replace_colons(message);
        message = emoji.replace_unified(message);

        chatContent.append(message);
        var scrollTo_val = $('#form-chat').prop('scrollHeight') + 'px';
        $('#form-chat').slimScroll({
            height: 240,
            scrollTo: scrollTo_val
        });
    }

    function play_sound() {
        document.getElementById('audiotag1').play();
    }
    $(window).focus(function () {
        isCWActive = true;
    });
    $(window).blur(function () {
        isCWActive = false;
    });


    function guid() {
        function _p8(s) {
            var p = (Math.random().toString(16) + "000000000").substr(2, 8);
            return s ? "-" + p.substr(0, 4) + "-" + p.substr(4, 4) : p;
        }
        return _p8() + _p8(true) + _p8(true) + _p8();
    }

    function validEmail($email) {
        var emailReg = /^([\w-+\.]+@([\w-]+\.)+[\w-]{2,10})?$/;
        if (!emailReg.test($email)) {
            return false;
        } else {
            return true;
        }
    }


    function setGuid() {
        var days = 365;
        var name = "__silcg";
        var value = "" + (new Date).getTime();
        var expires = "";
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toGMTString();
        document.cookie = name + "=" + value + expires + "; path=/; SameSite=None; Secure;";
    }

    function pushl(json) {
        var date = typeof (json.time) == 'string' ? parseInt(json.time) : json.time;
        if (json.message && json.message.length > 0) {
            addMessage(json.author, json.message, new Date(date), json.type, '', json.chatStatus);
        }
        // play_sound();
        // if (!isCWActive && !refresh && json.chatStatus != '' && json.chatStatus != 'ctyping' && json.chatStatus != 'ctypingoff' && json.chatStatus != 'atyping' && json.chatStatus != 'atypingoff') {
        //     play_sound();
        // } else if (refresh) {
        //     refresh = false;
        // }
    };


});