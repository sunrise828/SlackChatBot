var popupJsHost = (('https:' === document.location.protocol) ? 'https://' : 'http://');
var popupHost=popupJsHost+'www.socialintents.com';
    
//var actionUrl="http://localhost:8080/api/intent.jsp";
//var subscribeUrl="http://localhost:8080/api/subscribe.jsp";
var actionUrl=popupHost+"/api/intent.jsp";
var subscribeUrl= popupHost+"/api/subscribe.jsp";
var feedbackUrl= popupHost+"/api/feedback.jsp";
function siIsEmail(email) {
  var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,10})+$/;
  return regex.test(email);
}
function siIsPhone(phone) {
  var regex = /^[+]*[(]{0,1}[0-9]{1,3}[)]{0,1}[-\s\./0-9]*$/g;
  return regex.test(phone);
}
function intent(widgetId,offerId,type,docReferrer,page,uid)
{
    var now = new Date();
    var ping2=actionUrl+'?wid='+widgetId+'&oid='+offerId+'&type='+type+'&r='+docReferrer+'&p='+page +'&t='+now.getTime()+'&uid='+uid;
    $.ajax({
        type: 'GET',
        url: ping2,
        async: true,
        cache:false,
        jsonpCallback: 'jsonCallbackIntent',
        contentType: "application/json",
        dataType: 'jsonp',
        success: function(json) {
            var couponCode=json.couponCode;
            var couponReveal=json.couponReveal;
            var type=json.type;
            var link=json.link;
            var linkName=json.linkName;
            showCoupon(couponCode,couponReveal,type,link,linkName);
        },
        error: function(e) {
            console.log(e.message);
        }
    });
    localStorage.setItem("si_convert-"+widgetId,"true");
    localStorage.setItem("si_cvid-"+widgetId,"1");
}
function subscribe(widgetId,offerId,type,docReferrer,page, email,uid)
{
    var isEmail=siIsEmail(email);
    if (isEmail === true)
    {
        var now = new Date();
        var ping=subscribeUrl+'?wid='+widgetId+'&e='+email+'&oid='+offerId+'&type='+type+'&r='+docReferrer+'&p='+page +'&t='+now.getTime()+'&uid='+uid;
        $.ajax({
            type: 'GET',
            url: ping,
            async: true,
            cache:false,
            jsonpCallback: 'jsonCallback',
            contentType: "application/json",
            dataType: 'jsonp',
            success: function(json) {
                var status=json.status;
                var msg=json.message;
                var couponCode=json.couponCode;
                var couponReveal=json.couponReveal;
                var type=json.type;
                var link=json.link;
                var linkName=json.linkName;
                showConfirm(status,msg,couponCode,couponReveal,type,link,linkName);
            },
            error: function(e) {
                console.log(e.message);
            }
        });
        
        localStorage.setItem("si_convert-"+widgetId,"true");
        localStorage.setItem("si_cvid-"+widgetId,"1");
    }
    else
    {
        showConfirm(0,'');
    }
}

function subscribeLocalized(widgetId,offerId,type,docReferrer,page, email,uid, errorMessage, name, phone)
{
    var isEmail=siIsEmail(email);
    if (isEmail === true)
    {
        var now = new Date();
        var ping=subscribeUrl+'?wid='+widgetId+'&e='+email+'&name='+name+'&phone='+phone+'&oid='+offerId+'&type='+type+'&r='+docReferrer+'&p='+page +'&t='+now.getTime()+'&uid='+uid;
        //var ping=subscribeUrl+'?wid='+widgetId+'&e='+email+'&oid='+offerId+'&type='+type+'&r='+docReferrer+'&p='+page +'&t='+now.getTime()+'&uid='+uid;
        $.ajax({
            type: 'GET',
            url: ping,
            async: true,
            cache:false,
            jsonpCallback: 'jsonCallback',
            contentType: "application/json",
            dataType: 'jsonp',
            success: function(json) {
                var status=json.status;
                var msg=json.message;
                var couponCode=json.couponCode;
                var couponReveal=json.couponReveal;
                var type=json.type;
                var link=json.link;
                var linkName=json.linkName;
                showConfirm(status,msg,couponCode,couponReveal,type,link,linkName);
            },
            error: function(e) {
                console.log(e.message);
            }
        });
        
        localStorage.setItem("si_convert-"+widgetId,"true");
        localStorage.setItem("si_cvid-"+widgetId,"1");
    }
    else
    {
        showConfirm(0,errorMessage);
    }
}

function leaveFeedback(widgetId,categoryId, rating, feedback, docReferrer, page)
{
    var efeedback=encodeURIComponent(feedback);
    var now = new Date();
    var ping=feedbackUrl+'?wid='+widgetId+'&c='+categoryId+'&rating='+rating+'&f='+efeedback+'&r='+docReferrer+'&p='+page +'&t='+now.getTime();
    $.ajax({
        type: 'GET',
        url: ping,
        async: true,
        cache:false,
        jsonpCallback: 'jsonCallback',
        contentType: "application/json",
        dataType: 'jsonp',
        success: function(json) {
            var fid=json.id;
            $('#feedbackId').val(fid);
           
        },
        error: function(e) {
            console.log(e.message);
        }
    });
    
}
function leaveFeedbackEmail(widgetId,categoryId, rating, feedback, docReferrer, page, email)
{
    var efeedback=encodeURIComponent(feedback);
    var now = new Date();
    var ping=feedbackUrl+'?wid='+widgetId+'&c='+categoryId+'&rating='+rating+'&f='+efeedback+'&r='+docReferrer+'&email='+email+'&p='+page +'&t='+now.getTime();
    $.ajax({
        type: 'GET',
        url: ping,
        async: true,
        cache:false,
        jsonpCallback: 'jsonCallback',
        contentType: "application/json",
        dataType: 'jsonp',
        success: function(json) {
            var fid=json.id;
            $('#feedbackId').val(fid);
           
        },
        error: function(e) {
            console.log(e.message);
        }
    });
    
}
function fEmail(widgetId,email,fid)
{
    var now = new Date();
    var ping=feedbackUrl+'?wid='+widgetId+'&email='+email+'&fid='+fid+'&t='+now.getTime();
    $.ajax({
        type: 'GET',
        url: ping,
        async: true,
        cache:false,
        jsonpCallback: 'jsonCallback',
        contentType: "application/json",
        dataType: 'jsonp',
        success: function(json) {
            //var status=json.status;
            //var msg=json.message;
            //showConfirm(status,msg,couponCode,couponReveal);
        },
        error: function(e) {
            console.log(e.message);
        }
    });
    
}
function showCoupon(couponCode,couponReveal,offerType,link,linkName)
{
    if (couponCode || link)
    {
        var msg=couponReveal + ' ' + couponCode;
        if (offerType !== 'coupon')
        {
            msg=couponReveal + ' ' + '<a href="'+link+'" class="offerDownload" target="_blank">'+linkName+'</a>';
        }
        $('#couponCode').html(msg);
        $('#coupon').addClass("couponConverted");
        $('#couponCode').addClass("couponCodeConverted");
        
        var screenWidth=$(window).width();
        if (screenWidth < 380)
        {
            $('#social-table').addClass("socialTableConverted");
        }
        
        saveIntent(msg);
        
    }
}
function showFeedbackError(msg)
{
    
}
function showConfirm(status,msg,couponCode,couponReveal,offerType,link,linkName)
{
    if (status==1)
    {
        $('#emailMsg').removeClass("siError");
        $('#emailMsg').addClass("siConfirm");
        $('#emailMsg').html(msg);
        $('#emailAddress').hide();
        $('#emailAddressBtn').hide();
        if (couponCode || link)
        {
            var msg=couponReveal + ' ' + couponCode;
            if (offerType !== 'coupon')
            {
                msg=couponReveal + ' ' + '<a href="'+link+'" class="offerDownload" target="_blank">'+linkName+'</a>';
            }
            $('#couponCode').html(msg);
            $('#coupon').addClass("couponConverted");
            $('#couponCode').addClass("couponCodeConverted");
            
            var screenWidth=$(window).width();
            if (screenWidth < 380)
            {
                $('#social-table').addClass("socialTableConverted");
            }
        
            saveIntent(msg);
        }
        
    }
    else
    {
        $('#emailMsg').removeClass("siConfirm");
        $('#emailMsg').addClass("siError");
        
        if (msg && msg.length>0)
        {
            $('#emailMsg').html(msg);
        }
        else
        {
            $('#emailMsg').html("Invalid Email");
        }
        
    }
}
function saveIntent(message)
{
    sessionStorage.setItem("intent",message);
}
function getIntent()
{
    return sessionStorage.getItem("intent");
}
function checkOfferIntent()
{
    var intent = getIntent();
    if (intent && intent.length > 0)
    {
        $('#couponCode').html(intent);
        $('#coupon').addClass("couponConverted");
        $('#couponCode').addClass("couponCodeConverted");
        
    }
}





