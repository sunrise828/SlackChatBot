var siChatStarted = "";
$(function () {
    "use strict";
    
    
    var chatContent = $('#chatContent');
    var input = $('#message');
    var status = $('#status');
    var errorClosed = false;
    // var socket = atmosphere;
    var msgType = "visitor";
    var refresh = false;
    var typing = false;
    var sending = false;
    var typingTimer = null;
    var agentTypingTimer = null;

    var subSocket;
    var transport = 'long-polling';
    var lastMessageBy = "";
    var lastTime = 0;
    var chatStatus = '';

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
    var socket = io(chatUrl);
    
    socketInit();
    
    // return;
    var sessionId = "";
    try {
        sessionId = sessionStorage.getItem("si_chatsid_" + wid);
        if (!sessionId || sessionId.length === 0) {
            sessionId = guid();
            sessionStorage.setItem("si_chatsid_" + wid, sessionId);
            chatStatus = sessionStorage.getItem("si_chatstatus_" + wid);
            if (!chatStatus || chatStatus.length === 0) {
                chatStatus = "notstarted";
                sessionStorage.setItem("si_chatstatus_" + wid, chatStatus);
            }
        } else {
            //existing chat
            chatStatus = sessionStorage.getItem("si_chatstatus_" + wid);
            if (!chatStatus || chatStatus.length === 0) {
                chatStatus = "notstarted";
                sessionStorage.setItem("si_chatstatus_" + wid, chatStatus);
                //refresh=true;
            } else {
                refresh = true;
            }
        }
    } catch (err) {
        sessionId = guid();
    }

    function onMessage(response) {
        var json = response;
        var date = typeof (json.event_ts) == 'string' ? parseInt(json.event_ts) : json.event_ts;
        if (json.message && json.message.length > 0) {
            if (json.chatStatus === 'restart') {
                chatStatus = "notstarted";
                sessionStorage.setItem("si_chatstatus_" + wid, chatStatus);
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

                    if (chatStatus == "queued") {
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

    function socketInit() {
        socket.on('Room:Created', function(data) {
            userId = data.id;
            socket.emit('Joined:Room');
        });

        socket.on('Message', function (data) {
            console.log(data);
            onMessage(data);
        });
    };
    
    // if ("notstarted" !== chatStatus) {
    //     newSubscribe();
    //     $('#form-presales').hide();
    //     $('.siButtonActionClose-chat').removeClass('hidden');
    //     $('#form-chat-wrap').show();
    //     $('#message-area').show();

    //     $('#form-chat').show();
    //     $('#textarea').css({
    //         'display': 'table-row'
    //     });

    //     $('#body').css({
    //         'height': '251px;'
    //     });
    //     if (!/iPhone|iPod|Android/.test(window.navigator.userAgent)) {
    //         $('#message').focus();
    //     } else if (/iPhone|iPod/.test(window.navigator.userAgent)) {
    //         $('#message').addClass('message_ios');
    //     }
    //     loadEmoji();
    // }


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
                    name: sessionStorage.getItem("si_name"),
                    email: sessionStorage.getItem("si_email"),
                    phone: sessionStorage.getItem("si_phone"),
                    agentPhoto: '',
                    group: sessionStorage.getItem("si_group"),
                    version: '1.1',
                    consent: sessionStorage.getItem("si_consent"),
                    params: sessionStorage.getItem("si_params")
                };
                pushl(JSON.stringify(msg));
                socket.emit('Message', msg);
                // subSocket.push(msg);
                // if (errorClosed){
                //     errorClosed=false;
                //     subSocket = socket.subscribe(request);
                // }
            }
            $(this).val('').focus();
            try {
                $('.msgArea').emojiPicker('hide');
            } catch (err) { }
            autosize.destroy(document.querySelectorAll('#message'));
            setTimeout(function () {
                autosize(document.querySelector('#message'));
            }, 250);
        } else if (!typing) {
            if (!typingTimer) {
                // typingTimer = setTimeout(function () {
                //     var msg = $('#message').val();
                //     if (msg.length > 0 && !typing) {
                //         setTyping();
                //         var cs = "ctyping";
                //         sending = true;
                //         var ctime = new Date().getTime();
                //         subSocket.push(atmosphere.util.stringifyJSON({
                //             time: ctime,
                //             author: author,
                //             message: "",
                //             chatStatus: cs,
                //             type: msgType,
                //             wid: wid,
                //             sessionId: sessionId,
                //             currentPage: currentPage,
                //             agentId: aid,
                //             role: role,
                //             visits: visits,
                //             name: sessionStorage.getItem("si_name"),
                //             email: sessionStorage.getItem("si_email"),
                //             phone: sessionStorage.getItem("si_phone"),
                //             agentPhoto: '',
                //             group: sessionStorage.getItem("si_group"),
                //             version: '1.1',
                //             consent: sessionStorage.getItem("si_consent"),
                //             params: sessionStorage.getItem("si_params")
                //         }));
                //     } else {
                //         clearTyping();
                //     }
                // }, 6000);
            }
        } else if (typing) {
            if (!typingTimer) {
                // typingTimer = setTimeout(function () {
                //     var msg = $('#message').val();
                //     if (msg.length == 0) {
                //         var cs = "ctypingoff";
                //         typing = false;
                //         sending = true;
                //         clearTyping();
                //         var ctime = new Date().getTime();
                //         subSocket.push(atmosphere.util.stringifyJSON({
                //             time: ctime,
                //             author: author,
                //             message: "",
                //             chatStatus: cs,
                //             type: msgType,
                //             wid: wid,
                //             sessionId: sessionId,
                //             currentPage: currentPage,
                //             agentId: aid,
                //             role: role,
                //             visits: visits,
                //             name: sessionStorage.getItem("si_name"),
                //             email: sessionStorage.getItem("si_email"),
                //             phone: sessionStorage.getItem("si_phone"),
                //             agentPhoto: '',
                //             group: sessionStorage.getItem("si_group"),
                //             version: '1.1',
                //             consent: sessionStorage.getItem("si_consent"),
                //             params: sessionStorage.getItem("si_params")
                //         }));
                //     } else {
                //         clearTyping();
                //     }
                // }, 2500);
            }
        }

    });

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
        // if (!subSocket)
        // {
        //     subSocket = socket.subscribe(request);
        // }
        // if (refresh)
        // {
        //     //status.empty();
        //     setTimeout(function (){
        //         var ctime=new Date().getTime();
        //         subSocket.push(atmosphere.util.stringifyJSON({ time:ctime,author: author, message: '',chatStatus:'refresh',type:msgType,wid:wid,sessionId:sessionId,currentPage:currentPage,agentId:aid,role:role,visits:visits,name:sessionStorage.getItem("si_name"),email:sessionStorage.getItem("si_email"),phone:sessionStorage.getItem("si_phone"),agentPhoto:'',group:sessionStorage.getItem("si_group"),version:'1.1',consent:sessionStorage.getItem("si_consent"),params:sessionStorage.getItem("si_params")    }));

        //     }, 50);
        // }
    }
    $('#nops').click(function (event) {

        $('#form-chat-wrap').show();
        $('#message-area').show();
        $('#form-chat').show();

        $('#siWidget-chat').removeClass("siInvite");
        $('.silc-btn-button-close').show();
        $('.silc-btn-button-close').removeClass('fa fa-times-thin');

        $('#form-chat-invite').hide();
        $(".title-bg").removeClass("title-bg-ci");
        $(".title").removeClass("title-ci");
        $("#title-text").removeClass("title-text-ci");
        $('#form-presales').hide();

        if (/iPhone|iPod|Android/.test(window.navigator.userAgent)) {
            parent.postMessage("siNoScroll", "*");
        }

        var scrollTo_val = $('#form-chat').prop('scrollHeight') + 'px';
        $('#form-chat').slimScroll({
            height: 240,
            scrollTo: scrollTo_val
        });
        newSubscribe();
        if (/iPhone|iPod/.test(window.navigator.userAgent)) {
            $('#message').addClass('message_ios');
        }
        loadEmoji();
    });
    $('#nopsi').click(function (event) {
        var offline = $('#offline').val();
        var question = $('#question').val();
        var consent = "";
        var params = "";
        newSubscribe();
        var name = sessionStorage.getItem("si_name");
        var email = sessionStorage.getItem("si_email");
        var phone = sessionStorage.getItem("si_phone");
        var group = sessionStorage.getItem("si_group");
        var params = sessionStorage.getItem("si_params");

        var vname = true;
        var vemail = true;
        var vphone = true;
        var vgroup = true;
        var vconsent = true;

        if (vname && vemail && vphone && vgroup && vconsent) {
            if (offline === "true") {
                chatStatus = "offline";
                sending = true;
                var ctime = new Date().getTime();

                subSocket.push(atmosphere.util.stringifyJSON({
                    time: ctime,
                    author: author,
                    message: question,
                    chatStatus: chatStatus,
                    type: msgType,
                    wid: wid,
                    sessionId: sessionId,
                    currentPage: currentPage,
                    agentId: aid,
                    role: role,
                    visits: visits,
                    name: name,
                    email: email,
                    phone: phone,
                    agentPhoto: '',
                    group: group,
                    version: '1.1',
                    consent: consent,
                    params: params
                }));
                $('#form-presales').hide();
                $('#form-offline-sent').show();
                $('.siButtonActionClose-chat').removeClass('hidden');
                $('.silc-btn-button-close').removeClass('fa fa-times-thin');


            } else {
                sending = true;
                var ctime = new Date().getTime();

                subSocket.push(atmosphere.util.stringifyJSON({
                    time: ctime,
                    author: author,
                    message: question,
                    chatStatus: chatStatus,
                    type: msgType,
                    wid: wid,
                    sessionId: sessionId,
                    currentPage: currentPage,
                    agentId: aid,
                    role: role,
                    visits: visits,
                    name: name,
                    email: email,
                    phone: phone,
                    agentPhoto: '',
                    group: group,
                    version: '1.1',
                    consent: consent,
                    params: params
                }));
                $('#form-presales').hide();
                $('.siButtonActionClose-chat').removeClass('hidden');
                $('.silc-btn-button-close').removeClass('fa fa-times-thin');

                $('#form-chat-wrap').show();
                $('#message-area').show();
                $('#form-chat').show();

                $('.siButtonActionClose-chat').show();


                $('#siWidget-chat').removeClass("siInvite");
                $('#form-chat-invite').hide();
                $(".title-bg").removeClass("title-bg-ci");
                $(".title").removeClass("title-ci");
                $("#title-text").removeClass("title-text-ci");
                $('#form-presales').hide();
                if (/iPhone|iPod|Android/.test(window.navigator.userAgent)) {
                    parent.postMessage("siNoScroll", "*");
                }

                var scrollTo_val = $('#form-chat').prop('scrollHeight') + 'px';
                $('#form-chat').slimScroll({
                    height: 240,
                    scrollTo: scrollTo_val
                });
                newSubscribe();
                if (/iPhone|iPod/.test(window.navigator.userAgent)) {
                    $('#message').addClass('message_ios');
                }
                loadEmoji();
            }
        } else {
            if ($('#email').is(":visible") && !validEmail(email)) {
                $('#errorMsg').html("<p class='operator' style='color:red'>" + invalidEmailMessage + "</p>");
                $('#buffer').css('padding-top', '30px');
            } else {
                $('#errorMsg').html("<p class='operator' style='color:red'>" + genericError + "</p>");
                $('#buffer').css('padding-top', '30px');
            }


        }

    });
    $(document).on('click', '[id^=quick-reply]', function (e) {
        var replyVal = $(this).data("reply");
        e.preventDefault();
        e.stopPropagation();
        var ctime = new Date().getTime();

        subSocket.push(atmosphere.util.stringifyJSON({
            time: ctime,
            author: author,
            message: replyVal,
            chatStatus: chatStatus,
            type: msgType,
            wid: wid,
            sessionId: sessionId,
            currentPage: currentPage,
            agentId: aid,
            role: role,
            visits: visits,
            name: sessionStorage.getItem("si_name"),
            email: sessionStorage.getItem("si_email"),
            phone: sessionStorage.getItem("si_phone"),
            agentPhoto: '',
            group: sessionStorage.getItem("si_group"),
            version: '1.1',
            consent: sessionStorage.getItem("si_consent"),
            params: sessionStorage.getItem("si_params")
        }));
        sending = true;
        $("#message").val('').focus();
        try {
            $('.msgArea').emojiPicker('hide');
        } catch (err) { }

    });

    $('#preSalesStart').click(function (event) {
        refresh = false;
        newSubscribe();
        var offline = $('#offline').val();
        var name = $('#name').val();
        var email = $('#email').val();
        var phone = $('#phone').val();
        var custom = $('#custom').val();
        var params = $('#params').val();
        var consent = "";
        if ($('#consent').is(':checked')) {
            consent = "yes";
        }
        var question = $('#question').val();
        var group = $('#group').val();
        sessionStorage.setItem("si_name", name);
        sessionStorage.setItem("si_email", email);
        sessionStorage.setItem("si_phone", phone);
        sessionStorage.setItem("si_group", group);
        sessionStorage.setItem("si_consent", consent);
        var vname = true;
        var vemail = true;
        var vphone = true;
        var vgroup = true;
        var vconsent = true;
        if ($('#name').is(":visible") && name.length === 0) vname = false;
        if ($('#email').is(":visible") && email.length === 0) vemail = false;
        if ($('#email').is(":visible") && !validEmail(email)) vemail = false;

        if ($('#phone').is(":visible")) {
            var phonePH = $('#phone').attr('placeholder');
            if (phonePH.indexOf('*') >= 0 && phone.length === 0) {
                vphone = false;
            }
        }

        if ($('#group').is(":visible")) {
            var groupPH = $("#group option:selected").text();
            if (groupPH.indexOf('*') >= 0 && (group == null || group.length === 0)) {
                vgroup = false;
            }
        }

        if (invalidEmailMessage.length === 0) vemail = true;
        if (genericError.length === 0) {
            vname = true;
            vphone = true;
            vgroup = true;
        }
        if ($('#consent').is(":visible") && consent !== "yes") {
            vconsent = false;
            $(".consentlbl").addClass("consenterror");
        } else {
            $(".consentlbl").removeClass("consenterror");
        }

        if (vname && vemail && vphone && vgroup && vconsent) {

            sending = true;
            var ctime = new Date().getTime();

            socket.emit('User:Arrived', {
                time: ctime,
                author: author,
                message: question,
                chatStatus: chatStatus,
                type: msgType,
                wid: wid,
                sessionId: sessionId,
                currentPage: currentPage,
                agentId: aid,
                role: role,
                visits: visits,
                name: name,
                email: email,
                phone: phone,
                agentPhoto: '',
                group: group,
                version: '1.1',
                consent: consent,
                params: params
            });
            $('#form-presales').hide();
            $('.siButtonActionClose-chat').removeClass('hidden');
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

        } else {
            if ($('#email').is(":visible") && !validEmail(email)) {
                $('#errorMsg').html("<p class='operator' style='color:red'>" + invalidEmailMessage + "</p>");
                $('#buffer').css('padding-top', '30px');
            } else {
                $('#errorMsg').html("<p class='operator' style='color:red'>" + genericError + "</p>");
                $('#buffer').css('padding-top', '30px');
            }


        }

    });

    $('#btn-close-chat').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('#form-chat-wrap').show();
        $('#message-area').show();

        $('#form-chat').show();
        $('#form-close-chat').hide();
        chatStatus = "close";
        var msg = "";
        $('#textarea-wrapper').hide();
        sending = true;
        var ctime = new Date().getTime();

        subSocket.push(atmosphere.util.stringifyJSON({
            time: ctime,
            author: author,
            message: endMessage,
            chatStatus: chatStatus,
            type: msgType,
            wid: wid,
            sessionId: sessionId,
            currentPage: currentPage,
            agentId: aid,
            role: role,
            visits: visits,
            name: '',
            email: '',
            phone: '',
            agentPhoto: '',
            group: '',
            version: '1.1'
        }));
        setTimeout(function () {
            chatStatus = "notstarted";
            sessionStorage.setItem("si_chatstatus_" + wid, chatStatus);
        }, 250);
    });

    $('#btn-continue-chat').click(function (e) {
        e.preventDefault();
        e.stopPropagation();

        if ($('#form-offline-sent').is(":visible")) {
            $('#form-close-chat').hide();
        } else {
            $('#form-chat-wrap').show();
            $('#message-area').show();
            $('#form-chat').show();
            $('#form-close-chat').hide();
        }

    });

    $('#btn-minimize-chat').click(function (e) {
        e.preventDefault();
        e.stopPropagation();

        if ($('#form-offline-sent').is(":visible")) {
            $('#form-close-chat').hide();
        } else {
            $('#form-chat-wrap').show();
            $('#message-area').show();
            $('#form-chat').show();
            $('#form-close-chat').hide();
        }
        parent.postMessage("siCloseWindow", "*");

    });

    if (/iPhone|iPod|Android/.test(window.navigator.userAgent) || "1" == sessionStorage.getItem("standalone")) {
        $('.siButtonActionClose-chat').click(function (e) {
            if ("notstarted" !== chatStatus) {
                e.preventDefault();
                e.stopPropagation();
                $('#form-chat-wrap').hide();
                $('#message-area').hide();
                $('#form-chat').hide();
                $('#form-close-chat').show();
            }

        });
    }


    $('.siBtnSendTranscript').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('#form-chat-wrap').hide();
        $('#message-area').hide();

        $('#form-chat').hide();
        $('#form-send-transcript').show();
        $('#form-close-chat').hide();
        var email = $('#email').val();
        if (email && email.length > 0) {
            $('#emailAddress').val(email);
        }

    });
    $('#btn-transcript-continue-chat').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('#form-chat-wrap').show();
        $('#message-area').show();

        $('#form-chat').show();
        $('#form-close-chat').hide();
        $('#form-feedback').hide();
        $('#form-send-transcript').hide();

    });
    $('#btn-feedback-continue-chat').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('#form-chat-wrap').show();
        $('#message-area').show();

        $('#form-chat').show();
        $('#form-close-chat').hide();
        $('#form-feedback').hide();
        $('#form-send-transcript').hide();

    });
    $('#btn-send-transcript-form').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('#form-chat-wrap').hide();
        $('#message-area').hide();
        $('#form-chat').hide();
        $('#form-close-chat').hide();
        $('#form-feedback').hide();
        $('#form-send-transcript').show();
        var email = $('#email').val();
        if (email && email.length > 0) {
            $('#emailAddress').val(email);
        }
    });

    $('#btn-feedback-chat').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('#form-chat-wrap').hide();
        $('#message-area').hide();
        $('#form-chat').hide();
        $('#form-close-chat').hide();
        $('#form-send-transcript').hide();
        $('#form-feedback').show();
        var email = $('#email').val();
        if (email && email.length > 0) {
            $('#emailAddress').val(email);
        }
    });

    $('#btn-send-transcript').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        var email = $('#emailAddress').val();
        $('#form-chat-wrap').show();
        $('#message-area').show();
        $('#form-chat').show();
        $('#form-close-chat').hide();
        $('#form-send-transcript').hide();
        chatStatus = "close-transcript";
        author = email;
        var msg = "";
        $('#textarea-wrapper').hide();
        var ctime = new Date().getTime();

        subSocket.push(atmosphere.util.stringifyJSON({
            time: ctime,
            author: author,
            message: endMessage,
            chatStatus: chatStatus,
            type: msgType,
            wid: wid,
            sessionId: sessionId,
            currentPage: currentPage,
            agentId: aid,
            role: role,
            visits: visits,
            name: '',
            email: '',
            phone: '',
            agentPhoto: '',
            group: '',
            version: '1.1'
        }));
        sending = true;
        setTimeout(function () {
            chatStatus = "notstarted";
            sessionStorage.setItem("si_chatstatus_" + wid, chatStatus);
        }, 250);
    });

    $('#btn-send-feedback').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        var feedback = $('#feedback').val();
        $('#form-chat-wrap').show();
        $('#message-area').show();
        $('#form-chat').show();
        $('#form-close-chat').hide();
        $('#form-feedback').hide();
        $('#form-send-transcript').hide();

        var rating = $('input[name=rating]:checked').val();
        if (feedback.length > 0 || rating) {
            leaveFeedbackEmail(wid, '', rating, feedback, 'Live Chat', 'Live Chat', sessionStorage.getItem("si_email"));
        }

    });


    $('#btnSendHref').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        var msg = $("#message").val();
        var ctime = new Date().getTime();

        typing = false;
        var msg = atmosphere.util.stringifyJSON({
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
            name: sessionStorage.getItem("si_name"),
            email: sessionStorage.getItem("si_email"),
            phone: sessionStorage.getItem("si_phone"),
            agentPhoto: '',
            group: sessionStorage.getItem("si_group"),
            version: '1.1',
            consent: sessionStorage.getItem("si_consent"),
            params: sessionStorage.getItem("si_params")
        });
        pushl(msg);
        subSocket.push(msg);

        //subSocket.push(atmosphere.util.stringifyJSON({ time:ctime,author: author, message: msg,chatStatus:chatStatus,type:msgType,wid:wid,sessionId:sessionId,currentPage:currentPage,agentId:aid,role:role,visits:visits,name:sessionStorage.getItem("si_name"),email:sessionStorage.getItem("si_email"),phone:sessionStorage.getItem("si_phone"),agentPhoto:'',group:sessionStorage.getItem("si_group"),version:'1.1',consent:sessionStorage.getItem("si_consent"),params:sessionStorage.getItem("si_params")    }));
        //sending=true;
        $("#message").val('').focus();
        try {
            $('.msgArea').emojiPicker('hide');
        } catch (err) { }


        if (errorClosed) {
            errorClosed = false;
            subSocket = socket.subscribe(request);
        }

    });

    $('#btnFile').click(function (e) {
        e.preventDefault();
        e.stopPropagation();


    });

    function chatClosed() {
        $('#form-chat-wrap').show();
        $('#form-chat').show();
        $('#message-area').show();
        $('#form-close-chat').hide();
        chatStatus = "close";
        var msg = "";
        $('#textarea-wrapper').hide();
        setTimeout(function () {
            chatStatus = "notstarted";
            sessionStorage.setItem("si_chatstatus_" + wid, chatStatus);
            if (standalone == "1") {
                var msg = '<div class="sic-block sic-block-admin"><div class="si-comment-wrapper si-comment-wrapper-admin"><div class="si-comment-wrapper-admin-img"><div class="si-img"><img data-name="' + widgetTitle + '" class="initials img-circle"/></div></div><div class="si-comment si-comment-button"><div class="si-blocks"><div class="si-block si-block-paragraph">'
                msg += '<div class="c-message_attachment__row c-message_attachment__row--actions">'
                msg += '<a class="c-button c-button--outline c-button--small c-button-nomargin" href="/chatWidgetStandalone.jsp?wid=' + wid + '" >' + startNewMessage + '</a>';
                msg += '</div></div></div></div><span></span></div>';


                chatContent.append(msg);
                $('.initials').initial();
            } else if (mobile == "1") {
                var msg = '<div class="sic-block sic-block-admin"><div class="si-comment-wrapper si-comment-wrapper-admin"><div class="si-comment-wrapper-admin-img"><div class="si-img"><img data-name="' + widgetTitle + '" class="initials img-circle"/></div></div><div class="si-comment si-comment-button"><div class="si-blocks"><div class="si-block si-block-paragraph">'
                msg += '<div class="c-message_attachment__row c-message_attachment__row--actions">'
                msg += '<a class="c-button c-button--outline c-button--small c-button-nomargin" href="/chatWidgetStandalone.1.0.jsp?wid=' + wid + '" >' + startNewMessage + '</a>';
                msg += '</div></div></div></div><span></span></div>';

                chatContent.append(msg);
                $('.initials').initial();
            } else {
                var msg = '<div class="sic-block sic-block-admin"><div class="si-comment-wrapper si-comment-wrapper-admin"><div class="si-comment-wrapper-admin-img"><div class="si-img"><img data-name="' + widgetTitle + '" class="initials img-circle"/></div></div><div class="si-comment si-comment-button"><div class="si-blocks"><div class="si-block si-block-paragraph">'
                msg += '<div class="c-message_attachment__row c-message_attachment__row--actions">'
                msg += '<a class="c-button c-button--outline c-button--small c-button-nomargin" href="/chatWidget.1.0.jsp?wid=' + wid + '" >' + startNewMessage + '</a>';
                msg += '</div></div></div></div><span></span></div>';

                chatContent.append(msg);
                $('.initials').initial();
            }
            var scrollTo_val = $('#form-chat').prop('scrollHeight') + 'px';
            $('#form-chat').slimScroll({
                height: 240,
                scrollTo: scrollTo_val
            });

            parent.postMessage("siChatEnded", "*");

        }, 250);

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

    function checkAnswered() {
        if (chatStatus == 'queued') {
            chatStatus = "timeout";
            var ctime = new Date().getTime();
            subSocket.push(atmosphere.util.stringifyJSON({
                time: ctime,
                author: author,
                message: timeoutMessage,
                chatStatus: chatStatus,
                type: msgType,
                wid: wid,
                sessionId: sessionId,
                currentPage: currentPage,
                agentId: aid,
                role: role,
                visits: visits,
                name: sessionStorage.getItem("si_name"),
                email: sessionStorage.getItem("si_email"),
                phone: sessionStorage.getItem("si_phone"),
                agentPhoto: '',
                group: sessionStorage.getItem("si_group"),
                version: '1.1',
                consent: sessionStorage.getItem("si_consent"),
                params: sessionStorage.getItem("si_params")
            }));
            sending = true;
            $("#message-wrapper").hide();
        }

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

    function ping() {
        if (subSocket) {
            sending = true;
            var ctime = new Date().getTime();
            subSocket.push(atmosphere.util.stringifyJSON({
                time: ctime,
                author: "",
                message: "",
                chatStatus: "",
                type: "",
                wid: wid,
                sessionId: sessionId,
                currentPage: currentPage,
                agentId: aid,
                role: role,
                visits: visits,
                name: sessionStorage.getItem("si_name"),
                email: sessionStorage.getItem("si_email"),
                phone: sessionStorage.getItem("si_phone"),
                agentPhoto: '',
                group: sessionStorage.getItem("si_group"),
                version: '1.1',
                consent: sessionStorage.getItem("si_consent"),
                params: sessionStorage.getItem("si_params")
            }));
        }
    }

    function resub() {
        socket.unsubscribe();
        subSocket = socket.subscribe(request);
    }

    $('#fileUrl').click(function (e) {
        var url = $("#fileUrl").val();
        if (subSocket) {
            var msg = "::fuv::" + url;
            var ctime = new Date().getTime();

            subSocket.push(atmosphere.util.stringifyJSON({
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
                name: sessionStorage.getItem("si_name"),
                email: sessionStorage.getItem("si_email"),
                phone: sessionStorage.getItem("si_phone"),
                agentPhoto: '',
                group: sessionStorage.getItem("si_group"),
                version: '1.1',
                consent: sessionStorage.getItem("si_consent"),
                params: sessionStorage.getItem("si_params")
            }));
            sending = true;

        }

    });

    function validEmail($email) {
        var emailReg = /^([\w-+\.]+@([\w-]+\.)+[\w-]{2,10})?$/;
        if (!emailReg.test($email)) {
            return false;
        } else {
            return true;
        }
    }


    //resub();
    setInterval(function () {
        ping();
    }, 25000);

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

    function loadEmoji() {
        if (!/iPhone|iPod|Android/.test(window.navigator.userAgent)) {
            $("#btnEmoji").show();
            $("#btnFile").show();

        }
    };

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
            chatStatus = "queued";
            sessionStorage.setItem("si_chatstatus_" + wid, chatStatus);
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
                chatStatus = "notstarted";
                sessionStorage.setItem("si_chatstatus_" + wid, chatStatus);
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