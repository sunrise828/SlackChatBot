var siChatStarted = "";
$(function () {
    "use strict";

    var chatContent = $('#chatContent');
    var input = $('#message');
    var status = $('#status');
    var errorClosed = false;
    var msgType = "visitor";
    var refresh = false;
    var typing = false;
    var sending = false;
    var typingTimer = null;
    var agentTypingTimer = null;

    var lastMessageBy = "";
    var lastTime = 0;
    var chatStatus = ''; // 'no-support', 'not-started', 'queue', 'started'

    var chatUrl = chatwidget_vars.chatUrl;
    var wid = chatwidget_vars.wid;
    var author = chatwidget_vars.defaultVisitorText;
    var currentPage = chatwidget_vars.cp;
    var invalidEmailMessage = chatwidget_vars.invalidEmailMessage;
    var genericError = chatwidget_vars.genericError;
    var standalone = chatwidget_vars.sa;
    var mobile = chatwidget_vars.m;
    var endMessage = chatwidget_vars.endMessage;
    var timeoutMessage = chatwidget_vars.timeoutMessage;
    var chatNotifyCountsEnable = chatwidget_vars.chatNotifyCountsEnable;
    var timeoutSeconds = chatwidget_vars.timeoutSeconds;
    var startNewMessage = chatwidget_vars.startNewMessage;
    var waitingMessage = chatwidget_vars.waitingMessage;
    var visits = chatwidget_vars.visits;
    var widgetTitle = chatwidget_vars.widgetTitle;
    var aid = '';
    var role = '';
    var ap = '';
    var isCWActive = true;
    var resetSocketInterval = 10 * 60000;
    var userId = null;
    init();
    var socket = io(chatUrl);
    socketInit();
    
    var sessionId = "";
    try {
        sessionId = localStorage.getItem("rtp_chatsid_" + wid);
        if (!sessionId || sessionId.length === 0) {
            sessionId = guid();
            localStorage.setItem("rtp_chatsid_" + wid, sessionId);
            chatStatus = localStorage.getItem("rtp_chatstatus_" + wid);
            if (!chatStatus || chatStatus.length === 0) {
                chatStatus = "not-started";
                localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            }
        } else {
            //existing chat
            chatStatus = localStorage.getItem("rtp_chatstatus_" + wid);
            refresh = true;
        }
    } catch (err) {
        sessionId = guid();
    }
    renderPans();

    function renderPans () {
        $('button .loader').addClass('loaded');
        if (chatStatus == 'not-support') {
            $('.no-support').show();
            $('#wrapper').hide();
            $('#message-area').hide();
            $('#form-presales').hide();
            $('.siButtonActionClose-chat').removeClass('hidden');
        } else if (chatStatus == 'started' || chatStatus == 'queue') {
            newSubscribe();
            $('#form-presales').hide();
            $('.siButtonActionClose-chat').removeClass('hidden');
            $('#form-chat-wrap').show();
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
        var siName = localStorage.getItem("rtp_name");
        if (siName && siName.length > 0) { $("#name").val(siName); }
        var siEmail = localStorage.getItem("rtp_email");
        if (siEmail && siEmail.length > 0) { $("#email").val(siEmail); }
        $('.slim-scroll').slimScroll({
            height: chatwidget_vars.widgetHeight - 120,
            railVisible: true,
            start: 'bottom'
        });

        $('#title:not(.silc-btn-button-close)').click(function (event) {
            parent.postMessage("siCloseWindow", "*");
        });

        $('.silc-btn-button-close').click(function (e) {

            if ("" != siChatStarted
                && "timeout" !== siChatStarted) {
                e.preventDefault();
                e.stopPropagation();
                $('#form-chat-wrap').hide();
                $('#message-area').hide();
                $('#form-chat').hide();
                $('#form-close-chat').show();
            }
            else {
                parent.postMessage("siCloseWindow", "*");
            }
        });
        if (window.self === window.top) {
            var $viewportMeta = $('meta[name="viewport"]');
            $('input, select, textarea').bind('focus blur', function (event) {
                $viewportMeta.attr('content', 'width=device-width,initial-scale=1,maximum-scale=' + (event.type == 'blur' ? 10 : 1));
            });
        }
    }

    $('#preSalesStart').click(function (event) {
        refresh = false;
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
            vgroup = true;
        }
        
        if (vname && vemail) {

            sending = true;
            var ctime = new Date().getTime();

            $('button .loader').removeClass('loaded');
            socket.emit('User:Arrived', {
                time: ctime,
                author: author,
                wid: wid,
                sessionId: sessionId,
                currentPage: currentPage,
                name: name,
                email: email
            });
            
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
                agentTypingTimer = setTimeout(function (){
                    $('#typingIndicator').addClass('hide');
                }, 5000);
            }
        } else if (json.message && json.message.length > 0) {
            $('#typingIndicator').addClass('hide');
            clearAgentTyping();
            ap = '/images/material-person-white.png';
            addMessage(json.author, json.message, new Date(date), json.type, ap, json.chatStatus);
        }
        if (!isCWActive && !refresh && json.chatStatus != '' && json.chatStatus != 'ctyping' && json.chatStatus != 'ctypingoff' && json.chatStatus != 'atyping' && json.chatStatus != 'atypingoff') {
            play_sound();
        } else if (refresh) {
            refresh = false;
        }
        // setNoResponseTimer();
    };

    function socketInit() {
        socket.on('Room:Created', function (data) {
            chatStatus = 'started';
            localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            userId = data.id;
            socket.emit('Joined:Room');
            showMainPage();
            setNoResponseTimer();
        });

        socket.on('Message', function (data) {
            onMessage(data);
        });

        socket.on('NoSupport', function() {
            if (typingTimer) {
                clearTimeout(typingTimer);
                typingTimer = null;
            }
            
            chatStatus = 'not-support';
            localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            renderPans();
        });

        socket.on('Histories', function(event) {
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
                            agentId: aid,
                            role: role,
                            visits: visits,
                            name: localStorage.getItem("rtp_name"),
                            email: localStorage.getItem("rtp_email"),
                            phone: localStorage.getItem("rtp_phone"),
                            agentPhoto: '',
                            group: localStorage.getItem("rtp_group"),
                            version: '1.1',
                            consent: sessionStorage.getItem("rtp_consent"),
                            params: sessionStorage.getItem("rtp_params")
                        };
                        pushl(JSON.stringify(myMsg));
                    }
                })
            }

            if (event.status == 'finished') {
                addMessage('System', "This conversation is finished. Please open new!", new Date(), 
                    '', '/images/logo-white.png', 'close');
                chatClosed();
                    if (typingTimer) {
                    clearTimeout(typingTimer);
                    typingTimer = null;
                }
                
            }
        })

        socket.on('Error', function(event) {
            if (event.reason == 'wrong_workspace_id' && event.sessionId == sessionId) {
                chatStatus = 'notstarted';
                localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
                const error = 'You have a wrong workspace id now.\n Please contact our support!';
                $('#errorMsg').html("<p class='operator' style='color:red;text-align:center'>" + error + "</p>");
                $('#buffer').css('padding-top', '30px');
            } else if (event.reason == 'not_support' && event.sessionId == sessionId) {
                chatStatus = 'not-support';
                localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
                renderPans();
            }
        })
    };

    input.keydown(function (e) {
        if (e.keyCode === 13) {
            e.preventDefault();
            var msg = $(this).val();
            if (msg.length > 0) {
                typing = false;
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
                    agentId: aid,
                    role: role,
                    visits: visits,
                    name: localStorage.getItem("rtp_name"),
                    email: localStorage.getItem("rtp_email"),
                    phone: localStorage.getItem("rtp_phone"),
                    agentPhoto: '',
                    group: localStorage.getItem("rtp_group"),
                    version: '1.1',
                    consent: sessionStorage.getItem("rtp_consent"),
                    params: sessionStorage.getItem("rtp_params")
                };
                pushl(JSON.stringify(msg));
                socket.emit('Message', msg);
            }
            $(this).val('').focus();
            try {
                $('.msgArea').emojiPicker('hide');
            } catch (err) { }
        } else {
            socket.emit('Typing');
        }
        setNoResponseTimer();
    });

    function setNoResponseTimer() {
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            const message = "We haven't here from you in some time. Are you still with us?\n"
                + "Please respond if you are still there";

            addMessage('System', message, new Date(), 'admin', './images/logo-white.png', '2minAlert');
            typingTimer = setTimeout(() => {
                const message = "We are going to have to end this chat if we dont' hear from you."
                    + "We will hae to end this chat in 1 minute.";
                addMessage('System', message, new Date(), 'admin', './images/logo-white.png', '3minAlert');
                typingTimer = setTimeout(() => {
                    // finish the chat;
                    const message = "Thanks for using our system. This chat is timeout.";
                    addMessage('System', message, new Date(), 'admin', './images/logo-white.png', 'finished');
                    socket.emit('Finished');
                    chatClosed();
                }, 60 * 1000);
            }, 60 * 1000);
        }, 2 * 60 * 1000);
    }

    function setTyping() {
        clearTyping();
        typing = true;
    }

    function clearTyping() {
        clearTimeout(typingTimer)
        typingTimer = null;
    }

    function clearAgentTyping() {
        if (agentTypingTimer) {
            clearTimeout(agentTypingTimer)
            agentTypingTimer = null;
        }
    }

    function newSubscribe() {
        var siName = localStorage.getItem("rtp_name");
        var siEmail = localStorage.getItem("rtp_email");
        socket.emit('User:Arrived', {
            wid: wid,
            sessionId: sessionId,
            currentPage: currentPage,
            name: siName,
            email: siEmail
        });
    }
    $('#btn-close-chat').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        socket.emit('Finished');
        localStorage.clear();
        sessionId = guid();
        localStorage.setItem('rtp_chatsid_' + wid, sessionId);
        $('#form-close-chat').hide()
        $('#form-presales').show();
        $('#form-chat-wrap').hide();
        $('#message-area').hide();
        $('#form-chat').hide();
        $('.siButtonActionClose-chat').show();
    });

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
        if ("notstarted" !== chatStatus) {
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
        chatStatus = "close";
        // $('#textarea-wrapper').hide();
        $('.siButtonActionClose-chat').show();
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
        if (chatNotifyCountsEnable == 'on') {
            parent.postMessage("siMsg", "*");
        }
        var scrollTo_val = $('#form-chat').prop('scrollHeight') + 'px';
        $('#form-chat').slimScroll({
            height: 240,
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

    function pushl(message) {
        var json = '';
        try {
            message = message.replace(/[\u0000-\u0019]+/g, "<br>");
            json = JSON.parse(message);
            if (json.chatStatus && json.chatStatus != '') {
                siChatStarted = json.chatStatus;
                if (json.chatStatus == 'close') {
                    siChatStarted = '';
                }
            }
            if (lastTime == json.time) {
                return;
            } else {
                lastTime = json.time;
            }
            if (aid === '' && json.agentId !== '' && "close" !== json.chatStatus) {
                aid = json.agentId;
                role = json.role;
                ap = json.agentPhoto;
            }
            if (json.agentPhoto && json.agentPhoto.length > 0) {
                ap = json.agentPhoto;
            } else if (ap === "") {
                ap = "/images/material-person-white.png";
            }

        } catch (e) {
            //console.log('Error: ', message);
            return;
        }
        if ("notstarted" === json.chatStatus) {
            debugger
            chatStatus = "queued";
            sessionStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            if (timeoutSeconds && timeoutSeconds.length > 0) {
                var tsec = parseInt(timeoutSeconds) * 1000;
                setTimeout(function () {
                    checkAnswered()
                }, tsec);
            }

        } else if ("active" != chatStatus && json.chatStatus == "active") {
            //display agent header
            status.empty();
            if (json.agentId != '') {
                if (json.agentPhoto && json.agentPhoto.length > 0) {
                    ap = json.agentPhoto;
                    $(".si-img").show();
                    $("#si-img-img").attr("src", json.agentPhoto);
                }
                $('#agents').show();
                $('.agent-name').html(json.author);
                $('.agent-role').html(json.role);
            }

            $(".si-body").height(rsize);
            rsize = rsize - 80;;
            $('.slimScrollDiv #form-chat').unwrap();
            $('.slimScrollBar, .slimScrollRail').remove();
            var bh = (rsize - 100) + "px";
            $('#form-chat').slimScroll({
                height: $('#form-chat').css({
                    'height': bh
                }),
                railVisible: true,
                start: 'bottom'
            });

            chatStatus = "active";
        } else if ("active" == chatStatus && json.chatStatus == "active" &&
            json.agentPhoto && json.agentPhoto.length > 0 &&
            json.agentPhoto != $("#si-img-img").attr("src")) {
            //display agent header
            ap = json.agentPhoto;
            $(".si-img").show();
            $("#si-img-img").attr("src", json.agentPhoto);
            $('.agent-name').html(json.author);
            $('.agent-role').html(json.role);

        } else if ("close" === json.chatStatus) {
            chatClosed();

        } else if ("timeout" === json.chatStatus) {
            chatClosed();

        } else if ("wixrefresh" === json.chatStatus) {
            refreshWix();
        } else if ("atyping" === json.chatStatus) {
            $('#typingIndicator').removeClass('hide');
            clearAgentTyping();
            if (!agentTypingTimer) {
                agentTypingTimer = setTimeout(function () {
                    $('#typingIndicator').addClass('hide');
                }, 10000);
            }


        } else if ("atypingoff" === json.chatStatus) {
            clearAgentTyping();
            $('#typingIndicator').addClass('hide');
            //typing=false;
        }


        var date = typeof (json.time) == 'string' ? parseInt(json.time) : json.time;
        if (json.message && json.message.length > 0) {
            if (json.chatStatus === 'restart') {
                debugger
                chatStatus = "notstarted";
                sessionStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
                var msg = '<div class="sic-block sic-block-admin"><div class="si-comment-wrapper si-comment-wrapper-admin"><div class="si-comment"><div class="si-blocks"><div class="si-block si-block-paragraph">';
                msg += json.message;
                msg += '</div></div></div></div><span></span></div>';

                var newStatus = status.html() + msg;
                status.html(newStatus)
                json.message = '';
            } else if (json.chatStatus === 'pushMessages') {

                if (json.agentId != '') {
                    status.empty();
                    if (json.agentPhoto && json.agentPhoto.length > 0) {
                        ap = json.agentPhoto;
                        $(".si-img").show();
                        $("#si-img-img").attr("src", json.agentPhoto);

                    }
                    $('#agents').show();
                    $('.agent-name').html(json.author);
                    $('.agent-role').html(json.role);

                    $(".si-body").height(rsize);
                    rsize = rsize - 80;;
                    $('.slimScrollDiv #form-chat').unwrap();
                    $('.slimScrollBar, .slimScrollRail').remove();
                    var bh = (rsize - 120) + "px";
                    $('#form-chat').slimScroll({
                        height: $('#form-chat').css({
                            'height': bh
                        }),
                        railVisible: true,
                        start: 'bottom'
                    });

                    if (chatStatus === "queued") {
                        chatStatus = "active";
                    }
                }
                addPushMessages(json.message);

            } else {
                if ("close" === json.chatStatus) {
                    json.author = "";
                }
                addMessage(json.author, json.message, new Date(date), json.type, ap, json.chatStatus);
            }
            if ("agent" == json.type || "" == json.type) {
                $('#typingIndicator').addClass('hide');
                //typing=false;
            }

        }
        if (!isCWActive && !refresh && json.chatStatus != '' && json.chatStatus != 'ctyping' && json.chatStatus != 'ctypingoff' && json.chatStatus != 'atyping' && json.chatStatus != 'atypingoff') {
            play_sound();
        } else if (refresh) {
            refresh = false;
        }
    };
});