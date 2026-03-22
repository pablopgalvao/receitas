(function($){
  // Search
  var $searchWrap = $('#search-form-wrap'),
    isSearchAnim = false,
    searchAnimDuration = 200;

  var startSearchAnim = function(){
    isSearchAnim = true;
  };

  var stopSearchAnim = function(callback){
    setTimeout(function(){
      isSearchAnim = false;
      callback && callback();
    }, searchAnimDuration);
  };

  $('.nav-search-btn').on('click', function(){
    if (isSearchAnim) return;

    startSearchAnim();
    $searchWrap.addClass('on');
    stopSearchAnim(function(){
      $('.search-form-input').focus();
    });
  });

  $('.search-form-input').on('blur', function(){
    startSearchAnim();
    $searchWrap.removeClass('on');
    stopSearchAnim();
  });

  // Share
  $('body').on('click', function(){
    $('.article-share-box.on').removeClass('on');
  }).on('click', '.article-share-link', function(e){
    e.stopPropagation();

    var $this = $(this),
      url = $this.attr('data-url'),
      encodedUrl = encodeURIComponent(url),
      id = 'article-share-box-' + $this.attr('data-id'),
      title = $this.attr('data-title'),
      offset = $this.offset();

    if ($('#' + id).length){
      var box = $('#' + id);

      if (box.hasClass('on')){
        box.removeClass('on');
        return;
      }
    } else {
      var html = [
        '<div id="' + id + '" class="article-share-box">',
          '<input class="article-share-input" value="' + url + '">',
          '<div class="article-share-links">',
            '<a href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(title) + '&url=' + encodedUrl + '" class="article-share-twitter" target="_blank" title="Twitter"><span class="fa fa-twitter"></span></a>',
            '<a href="https://www.facebook.com/sharer.php?u=' + encodedUrl + '" class="article-share-facebook" target="_blank" title="Facebook"><span class="fa fa-facebook"></span></a>',
            '<a href="http://pinterest.com/pin/create/button/?url=' + encodedUrl + '" class="article-share-pinterest" target="_blank" title="Pinterest"><span class="fa fa-pinterest"></span></a>',
            '<a href="https://www.linkedin.com/shareArticle?mini=true&url=' + encodedUrl + '" class="article-share-linkedin" target="_blank" title="LinkedIn"><span class="fa fa-linkedin"></span></a>',
          '</div>',
        '</div>'
      ].join('');

      var box = $(html);

      $('body').append(box);
    }

    $('.article-share-box.on').hide();

    box.css({
      top: offset.top + 25,
      left: offset.left
    }).addClass('on');
  }).on('click', '.article-share-box', function(e){
    e.stopPropagation();
  }).on('click', '.article-share-box-input', function(){
    $(this).select();
  }).on('click', '.article-share-box-link', function(e){
    e.preventDefault();
    e.stopPropagation();

    window.open(this.href, 'article-share-box-window-' + Date.now(), 'width=500,height=450');
  });

  // Caption
  $('.article-entry').each(function(i){
    $(this).find('img').each(function(){
      if ($(this).parent().hasClass('fancybox') || $(this).parent().is('a')) return;

      var alt = this.alt;

      if (alt) $(this).after('<span class="caption">' + alt + '</span>');

      $(this).wrap('<a href="' + this.src + '" data-fancybox=\"gallery\" data-caption="' + alt + '"></a>')
    });

    $(this).find('.fancybox').each(function(){
      $(this).attr('rel', 'article' + i);
    });
  });

  if ($.fancybox){
    $('.fancybox').fancybox();
  }

  // Mobile nav
  var $container = $('#container'),
    isMobileNavAnim = false,
    mobileNavAnimDuration = 200;

  var startMobileNavAnim = function(){
    isMobileNavAnim = true;
  };

  var stopMobileNavAnim = function(){
    setTimeout(function(){
      isMobileNavAnim = false;
    }, mobileNavAnimDuration);
  }

  $('#main-nav-toggle').on('click', function(){
    if (isMobileNavAnim) return;

    startMobileNavAnim();
    $container.toggleClass('mobile-nav-on');
    stopMobileNavAnim();
  });

  $('#wrap').on('click', function(){
    if (isMobileNavAnim || !$container.hasClass('mobile-nav-on')) return;

    $container.removeClass('mobile-nav-on');
  });

  // Popup fixo para download do app Lar do Chef
  var $appPopup = $('#app-download-popup');
  if ($appPopup.length) {
    var isAndroid = /Android/i.test((navigator.userAgent || ''));
    var storageKey = 'appDownloadPopupDismissed';

    var hidePopup = function() {
      $appPopup.removeClass('is-visible');
      // Em dispositivos Android, não persistir o fechamento para que o popup
      // volte a aparecer sempre que a página for carregada.
      if (isAndroid) {
        return;
      }

      try {
        if (window.localStorage) {
          window.localStorage.setItem(storageKey, '1');
        }
      } catch (e) {}
    };

    var showPopup = function() {
      // Em dispositivos Android, ignorar a verificação de localStorage para
      // garantir que o popup apareça em todo carregamento de página.
      if (!isAndroid) {
        try {
          if (window.localStorage && window.localStorage.getItem(storageKey) === '1') {
            return;
          }
        } catch (e) {}
      }

      $appPopup.attr('aria-hidden', 'false').addClass('is-visible');
    };

    // Exibe o popup alguns segundos após o carregamento da página
    setTimeout(showPopup, 2000);

    $appPopup.on('click', '.app-download-popup-close', function() {
      hidePopup();
    });

    // Se o usuário clicar no botão de download em página de post,
    // tenta abrir o app com deep link para o post específico.
    $appPopup.on('click', '.app-download-popup-button', function(e) {
      var postUrl = $('body').attr('data-post-url');

      // Se não for página de post, deixa seguir o href padrão (Play Store)
      if (!postUrl) {
        return;
      }

      e.preventDefault();

      try {
        var encodedPostUrl = encodeURIComponent(postUrl);
        var appUrl = 'boil://receita?url=' + encodedPostUrl;
        var fallbackUrl = 'https://play.google.com/store/apps/details?id=com.pablo614.Boil';
        var start = Date.now();

        var timer = setTimeout(function() {
          if (Date.now() - start < 2000) {
            window.location.href = fallbackUrl;
          }
        }, 1200);

        window.location.href = appUrl;
      } catch (err) {
        console.error('Erro ao tentar abrir o app Boil a partir do popup:', err);
        window.location.href = 'https://play.google.com/store/apps/details?id=com.pablo614.Boil';
      }
    });
  }
})(jQuery);