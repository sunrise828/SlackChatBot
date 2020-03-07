var siChatStarted = "";
$(function () {
    "use strict";

    var chatContent = $('#chatContent');
    var input = $('#message');
    var msgType = "visitor";
    var lastMessageBy = "";
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
    var systemIcon = chatwidget_vars.baseUrl + 'images/logo-white.png';
    var supportManName = 'Support Man';
    var supportManIcon = chatwidget_vars.baseUrl + 'images/material-person-white.png';
    var widgetTitle = chatwidget_vars.widgetTitle;
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
        $('#title-text').addClass('loaded');
        if (chatStatus == 'not-support') {
            $('.container-fluid.loader').hide();
            $('.no-support').show();
            $('#wrapper').hide();
            $('#message-area').hide();
            $('#form-presales').show();
            $('.siButtonActionClose-chat').hide();
        } else if (chatStatus != 'not-started') {
            $('.container-fluid.loader').hide();
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

        } else if (chatStatus == 'not-started') {
            $('.container-fluid.loader').hide();
            $('#form-presales').show();
            $('.siButtonActionClose-chat').hide();
            $('#form-chat-wrap').hide();
            $('#message-area').hide();
            $('#form-chat').hide();
            $('#title-text').removeClass('loaded');
        }
    }

    function init() {
        if (chatStatus != 'not-started') {
            socket = io(chatUrl);
            socketInit();
            var tempIcon = localStorage.getItem('support-man-icon');
            supportManIcon = tempIcon || chatwidget_vars.baseUrl + 'images/material-person-white.png';
            supportManName = localStorage.getItem('support-man-name') || 'Support Man';
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
            $('#title-text').removeClass('loaded');
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
        $('#title-text').addClass('loaded');
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
    }

    function onMessage(response) {
        var json = response;
        var date = moment(response.event_ts).local().format('hh:mm a');
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
                var ap = supportManIcon;
                addMessage(supportManName, json.message, date, json.type, ap, json.chatStatus);
                if (!isCWActive)
                    play_sound();
            } else {
                lastMessageBy = json.author;
                addMessage(json.author, json.message, date, msgType, '', chatStatus);
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
        socket.on('Welcome', function (event) {
            const utcTime = moment(event.ts).utcOffset(0).toISOString();
            var time = moment(utcTime).local().format('hh:mm a');
            $('.siButtonActionClose-chat').show();
            $('#title-text').html(chatwidget_vars.widgetTitle + `(#T-${event.ticket})`);
            $('#status .welcome-msg .si-block-paragraph').html(event.welcomeMsg);
            setTimeout(function () {
                var html = `<div class="sic-block sic-block-admin ticket-info">
                        <div class="si-comment-wrapper si-comment-wrapper-admin">
                            <div class="si-comment-wrapper-admin-img">
                                <div class="si-img">
                                    <img id="initials" data-name="Live Chat" src="${systemIcon}" class="initials img-circle">
                                </div>
                            </div>
                            <div class="si-comment">
                                <div class="si-blocks">
                                    <div class="si-block si-block-paragraph">
                                        A ticket for this conversation has been created.  Your ticket number is: #T-${event.ticket}
                                    </div>
                                </div>
                            </div>
                            <div class="si-comment-wrapper-admin-name">${time}</div>
                        </div>
                        <span></span>
                    </div>`;
                if ($('#status .ticket-info').length <= 0) {
                    $('#status').append(html);
                } else {
                    $('#status .ticket-info').replaceWith(html);
                }
            }, 500);

        })

        socket.on('Joined:Slack', function (data) {
            if (data.photoUrl && data.photoUrl.length > 0) {
                supportManIcon = data.photoUrl;
                localStorage.setItem('support-man-icon', supportManIcon);
            }

            if (data.supportName && data.supportName.length > 0) {
                supportManName = data.supportName;
                localStorage.setItem('support-man-name', supportManName);
            }
            
            const utcTime = moment(data.ts).utcOffset(0).toISOString();
            var time = moment(utcTime).local().format('hh:mm a');
            addMessage('System', data.message, time, 'admin', systemIcon, 'joined');
        });

        socket.on('Room:Created', function (data) {
            $('.container-fluid.loader').show();
            if (data.ticket) {
                $('#title-text').html(chatwidget_vars.widgetTitle + `(#T-${data.ticket})`);
            }
            chatStatus = 'started';
            localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            socket.emit('Joined:Room');
            showMainPage();
        });

        socket.on('Message', function (data) {
            onMessage(data);
            if (data.domain != 'user')
                parent.postMessage('siMessage', '*');
        });

        socket.on('NoSupport', function () {
            chatStatus = 'not-support';
            localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            renderPans();
            parent.postMessage('siMessage', '*');
        });

        socket.on('Ticket:Create', function (event) {
            $('#title-text').html(chatwidget_vars.widgetTitle + `(#T-${event.ticket})`);
        })

        socket.on('Histories', function (event) {
            $('.container-fluid.loader').hide();
            $('button .loader').removeClass('loaded');
            $('#title-text').addClass('loaded');
            $('.siButtonActionClose-chat').show();
            chatContent.html('');
            if (event.ticket) {
                $('#title-text').html(chatwidget_vars.widgetTitle + `(#T-${event.ticket})`);
            }
            if (event.msgs.length > 0) {
                event.msgs.forEach(msg => {
                    if (msg.domain == 'system-user') return;
                    const utcTime = moment(msg.createdAt).utcOffset(0).toISOString();
                    var date = moment(utcTime).local().format('hh:mm a');
                    if (msg.domain == 'slack') {
                        addMessage('Support Man', msg.text, date,
                            '', supportManIcon, 'queue');
                    } else if (msg.domain == 'system') {
                        addMessage('System', msg.text, date,
                            '', systemIcon, 'system');
                    } else {
                        var myMsg = {
                            time: date,
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
                chatFinished();
            } else if (event.status == 'history') {
                chatStatus = 'started';
                localStorage.setItem("rtp_chatstatus_" + wid, chatStatus);
            }
        })

        socket.on('Error', function (event) {
            $('.container-fluid.loader').hide();
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
            if (event.sessionId == sessionId)
                renderPans();
        })

        socket.on('Alert', function (event) {
            const utcTime = moment(event.ts).utcOffset(0).toISOString();
            var time = moment(utcTime).local().format('hh:mm a');
            addMessage('System', event.msg, time, 'admin', systemIcon, 'Alert');
            if (!isCWActive)
                play_sound();
            parent.postMessage('siMessage', '*');
        });

        socket.on('Finish:Alert', function (event) {
            chatStatus = "not-started";
            localStorage.setItem('rtp_chatstatus_' + wid, chatStatus);
            var email = localStorage.getItem("rtp_email");
            var msg = 'This chat has been completed and a copy of the transcript has been emailed to you at ' + email;
            const utcTime = moment(event.ts).utcOffset(0).toISOString();
            var time = moment(utcTime).local().format('hh:mm a');
            addMessage('System', msg, time, 'admin', systemIcon, 'Alert');
            chatClosed();
        });

        socket.on('Finished', function (event) {
            chatFinished();
        });
    };

    function chatFinished() {
        chatStatus = 'not-started';
        localStorage.setItem('rtp_chatstatus_' + wid, chatStatus);
        socket.disconnect();
        socket = null;
        // $('#form-close-chat').hide()
        // $('#form-presales').show();
        // $('#form-chat-wrap').hide();
        $('#message-area').hide();
        // $('#form-chat').hide();
        // $('#title-text').html(widgetTitle);
        $('button .loader').addClass('loaded');
        $('.siButtonActionClose-chat').show();
        var email = localStorage.getItem("rtp_email");
        var msg = 'This chat has been completed and a copy of the transcript has been emailed to you at ' + email;
        addMessage('System', msg, new Date().getTime(), 'admin', systemIcon, 'Alert');
    }

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
    $(body).on('click', '#btn-continue-chat', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('#form-chat-wrap').show();
        if (chatStatus == 'not-started' || chatStatus == 'close') {
            $('#message-area').hide();
        } else {
            $('#message-area').show();
        }

        $('#form-chat').show();
        $('#form-close-chat').remove();
    });

    $(body).on('click', '#btn-close-chat', function (e) {
        e.preventDefault();
        e.stopPropagation();
        socket.emit('Finished', { status: 'closed' });
        chatStatus = 'not-started';
        localStorage.setItem('rtp_chatstatus_' + wid, chatStatus);
        socket.disconnect();
        socket = null;
        $('#errorMsg').html('');
        $('#form-close-chat').remove();
        // $('#form-presales').show();
        // $('#form-chat-wrap').hide();
        $('#message-area').hide();
        // $('#form-chat').hide();
        // $('#title-text').html(widgetTitle);
        // $('.siButtonActionClose-chat').hide();
        $('button .loader').addClass('loaded');
        // $('#title-text').addClass('loaded');
        var email = localStorage.getItem("rtp_email");
        var msg = 'This chat has been completed and a copy of the transcript has been emailed to you at ' + email;
        var time = moment().local().format('hh:mm a');
        addMessage('System', msg, time, 'admin', systemIcon, 'Alert');
    });

    $('.silc-btn-button-close').click(function (e) {
        $('#form-close-chat').remove();
        if ("not-started" !== chatStatus) {
            e.preventDefault();
            e.stopPropagation();
            $('#form-close-chat-org').clone().attr('id', 'form-close-chat').appendTo(chatContent);
            $('#form-close-chat').show();
            var scrollTo_val = $('#form-chat').prop('scrollHeight') + 'px';
            $('#form-chat').slimScroll({
                scrollTo: scrollTo_val
            });
            setTimeout(() => {


                $('#btn-continue-chat').click(function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    $('#form-chat-wrap').show();
                    if (chatStatus == 'not-started' || chatStatus == 'close') {
                        $('#message-area').hide();
                    } else {
                        $('#message-area').show();
                    }

                    $('#form-chat').show();
                    $('#form-close-chat').remove();
                })
            }, 50);
        }

    });

    $('.silc-btn-button-minimize').click(function (e) {
        parent.postMessage('siMinimize', '*');
    });

    function chatClosed() {
        $('#form-chat-wrap').show();
        $('#form-chat').show();
        $('#message-area').hide();
        $('#form-close-chat').hide();
    }

    function addMessage(author, message, datetime, msgType, agentPhoto, chatStatus) {
        message = replaceAll(message, "&amp;", "&");
        message = replaceAll(message, "&lt;", "<");
        message = replaceAll(message, "&gt;", ">");
        message = replaceAll(message, "&quot;", "\"");
        message = replaceAll(message, "&#39;", "'");
        message = replaceAll(message, "&#61;", "=");
        message = replaceAll(message, "&#43;", "+");
        message = replaceAll(message, "&#34;", "\"");

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
                msg += `</div></div></div><div class="si-comment-wrapper-admin-name">${datetime}</div></div></div>`;
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
                    msg += `</div></div></div><div class="si-comment-wrapper-admin-name">${datetime}</div></div></div>`;
                    chatContent.append(msg);
                }

            }

        } else {
            if ('visitor' == msgType) {
                var msg = '<div class="sic-block sic-block-user sic-block-last"><div class="si-comment-wrapper si-comment-wrapper-user"><div class="si-comment"><div class="si-blocks"><div class="si-block si-block-paragraph">'
                msg += message;
                msg += `</div></div></div><div class="si-comment-wrapper-admin-name">${datetime}</div></div></div>`;
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
                    msg += `</div></div></div><div class="si-comment-wrapper-admin-name">${datetime}</div></div></div>`;
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
        if (json.message && json.message.length > 0) {
            addMessage(json.author, json.message, json.time, json.type, '', json.chatStatus);
        }
        // play_sound();
        // if (!isCWActive && !refresh && json.chatStatus != '' && json.chatStatus != 'ctyping' && json.chatStatus != 'ctypingoff' && json.chatStatus != 'atyping' && json.chatStatus != 'atypingoff') {
        //     play_sound();
        // } else if (refresh) {
        //     refresh = false;
        // }
    };


});