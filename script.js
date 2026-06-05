// ==================== PWA ====================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/_pr/service-worker.js');
}

// ==================== 轮播逻辑 ====================
const projects = [
  { title: "石家庄高铁皇冠假日酒店", location: "河北 石家庄" },
  { title: "大连宾乐雅酒店", location: "辽宁 大连" },
  { title: "芜湖开元名都大酒店", location: "安徽 芜湖" },
  { title: "福州井邑温泉酒店", location: "福建 福州" },
  { title: "南通一德酒店", location: "江苏 南通" }
];

const slides = document.querySelectorAll('#view-home .slide');
const dotsContainer = document.getElementById('dotsContainer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const projectTitle = document.getElementById('projectTitle');
const projectLocation = document.getElementById('projectLocation');

let currentIndex = 0;
const totalSlides = slides.length;
let autoPlayTimer = null;
const interval = 5000;

function createDots() {
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.dataset.index = i;
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(dot);
  }
  updateDots();
}

function updateDots() {
  document.querySelectorAll('#view-home .dot').forEach(dot => {
    dot.classList.toggle('active', Number(dot.dataset.index) === currentIndex);
  });
}

function updateContent() {
  projectTitle.textContent = projects[currentIndex].title;
  projectLocation.textContent = projects[currentIndex].location;
}

function showSlide(index) {
  slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
  currentIndex = index;
  updateDots();
  updateContent();
}

function goToSlide(index) {
  showSlide((index + totalSlides) % totalSlides);
  resetAutoPlay();
}

function prevSlide() { goToSlide(currentIndex - 1); }
function nextSlide() { goToSlide(currentIndex + 1); }
function startAutoPlay() { autoPlayTimer = setInterval(nextSlide, interval); }
function resetAutoPlay() { clearInterval(autoPlayTimer); startAutoPlay(); }

prevBtn.addEventListener('click', prevSlide);
nextBtn.addEventListener('click', nextSlide);

createDots();
updateContent();
startAutoPlay();

// ==================== 视图切换逻辑 ====================
const viewHome = document.getElementById('view-home');
const subViews = document.querySelectorAll('.sub-view');
const navLinks = document.querySelectorAll('.nav a');
const brandLink = document.getElementById('brandLink');

function switchView(viewName) {
  subViews.forEach(v => v.classList.remove('active'));

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.dataset.view === viewName) link.classList.add('active');
  });

  if (viewName === 'home') {
    viewHome.style.display = 'flex';
    header.classList.remove('on-sub');
    document.body.style.background = '#000';
    resetAutoPlay();
  } else {
    viewHome.style.display = 'none';
    clearInterval(autoPlayTimer);
    header.classList.add('on-sub');
    document.body.style.background = '#f5f5f7';
    const targetView = document.getElementById('view-' + viewName);
    if (targetView) {
      targetView.classList.add('active');
      targetView.scrollTop = 0;
      if (targetView._init) targetView._init();
    }
  }
}

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    switchView(link.dataset.view);
  });
});

brandLink.addEventListener('click', () => switchView('home'));

// ==================== 项目图片点击与中心放大逻辑 ====================
(function() {
  var rows = document.querySelectorAll('.proj-row');
  var view = document.getElementById('view-projects');
  if (!rows.length || !view) return;

  var ACTIVE_CLASS = 'proj-img-enlarged';
  var ACTIVE_ROW_CLASS = 'active';
  var ANIM_DURATION = 3000;
  var pendingRow = null;
  var activeImg = null;
  var activeRow = null;
  var scrollAnimId = null;
  var shrinkAnimId = null;
  var shrinkingRow = null;
  var shrinkingImg = null;

  // ---- multi-image helpers ----

  function getActiveImg(row) {
    return row.querySelector('.proj-img.active');
  }

  function getImgCount(row) {
    var c = row.querySelector('.proj-imgs');
    return c ? (parseInt(c.dataset.total) || c.querySelectorAll('.proj-img').length) : 0;
  }

  function getImgAt(row, idx) {
    return row.querySelectorAll('.proj-img')[idx] || null;
  }

  function getImgIndex(img) {
    return parseInt(img.dataset.index) || 0;
  }

  // ---- animation control ----

  function cancelScrollAnim() {
    if (scrollAnimId) { cancelAnimationFrame(scrollAnimId); scrollAnimId = null; }
  }

  function cancelShrinkAnim() {
    if (shrinkAnimId) { cancelAnimationFrame(shrinkAnimId); shrinkAnimId = null; }
  }

  function resetImageState(row, img) {
    row.style.marginTop = '';
    row.style.marginBottom = '';
    img.style.transform = '';
    img.style.filter = '';
    img.style.height = '';
    img.classList.remove(ACTIVE_CLASS);
    row.classList.remove(ACTIVE_ROW_CLASS);
    row._maxOverflow = undefined;
    row._maxInfoShift = undefined;
    var info = row.querySelector('.proj-info');
    if (info) { info.style.transform = ''; info.style.zIndex = ''; }
  }

  function balanceRows() {
    rows.forEach(function(row) {
      var info = row.querySelector('.proj-info');
      if (!getActiveImg(row) || !info) return;
      var spacer = row.querySelector('.proj-spacer');
      var w = info.offsetWidth + 'px';
      if (!spacer) {
        spacer = document.createElement('div');
        spacer.className = 'proj-spacer';
        spacer.style.minWidth = w;
        spacer.style.maxWidth = w;
        row.appendChild(spacer);
      } else {
        spacer.style.minWidth = w;
        spacer.style.maxWidth = w;
      }
    });
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ---- shrink animation ----

  function smoothShrink(row, img, duration) {
    if (shrinkingImg && shrinkingImg !== img) {
      resetImageState(shrinkingRow, shrinkingImg);
    }
    cancelShrinkAnim();
    shrinkingRow = row;
    shrinkingImg = img;
    var startTime = null;
    var startMargin = row._maxOverflow || parseFloat(row.style.marginTop) || 0;
    var info = row.querySelector('.proj-info');
    var startScale = parseFloat(img.style.transform.replace(/scale\(|\)/g, '')) || 1.62;
    var maxInfoShift = row._maxInfoShift || (img.getBoundingClientRect().width * 0.31);

    function step(ts) {
      if (!startTime) startTime = ts;
      var elapsed = ts - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var ease = easeInOut(progress);

      row.style.marginTop = (startMargin * (1 - ease)) + 'px';
      row.style.marginBottom = (startMargin * (1 - ease)) + 'px';

      if (info) {
        info.style.transform = 'translate(' + (-maxInfoShift * (1 - ease)) + 'px, ' + (-startMargin * (1 - ease)) + 'px)';
      }

      img.style.transform = 'scale(' + (startScale - (startScale - 1) * ease) + ')';
      img.style.filter = 'grayscale(' + (0.2 * ease).toFixed(3) + ') brightness(' + (0.95 + 0.05 * (1 - ease)).toFixed(3) + ')';

      if (progress < 1) {
        shrinkAnimId = requestAnimationFrame(step);
      } else {
        row.style.marginTop = '';
        row.style.marginBottom = '';
        if (info) { info.style.transform = ''; info.style.zIndex = ''; }
        img.style.transform = '';
        img.style.filter = '';
        img.style.height = '';
        img.classList.remove(ACTIVE_CLASS);
        row.classList.remove(ACTIVE_ROW_CLASS);
        shrinkAnimId = null;
        shrinkingRow = null;
        shrinkingImg = null;
      }
    }

    shrinkAnimId = requestAnimationFrame(step);
  }

  // ---- enlarge animation ----

  function computeCenteredScroll(img, extraOffset) {
    var rect = img.getBoundingClientRect();
    var vr = view.getBoundingClientRect();
    var imgCenter = rect.top + (extraOffset || 0) + rect.height * 0.5;
    var viewCenter = (vr.top + vr.bottom) / 2;
    var target = view.scrollTop + (imgCenter - viewCenter);
    return Math.max(0, Math.min(target, view.scrollHeight - view.clientHeight));
  }

  function smoothScrollToCenter(row, img, duration, doScroll) {
    cancelScrollAnim();
    var startTime = null;
    var maxOverflow, maxInfoShift, info, targetScroll, scrolled;

    function step(ts) {
      if (!startTime) {
        if (img.getBoundingClientRect().height === 0) {
          scrollAnimId = requestAnimationFrame(step);
          return;
        }
        startTime = ts;
        maxOverflow = row._maxOverflow || (img.getBoundingClientRect().height * 0.31);
        maxInfoShift = row._maxInfoShift || (img.getBoundingClientRect().width * 0.31);
        row._maxOverflow = maxOverflow;
        row._maxInfoShift = maxInfoShift;
        info = row.querySelector('.proj-info');

        if (doScroll) {
          targetScroll = computeCenteredScroll(img, maxOverflow);
          if (targetScroll > 0 || view.scrollTop > 0) {
            view.scrollTop = targetScroll;
            scrolled = true;
          }
        }
      }
      var elapsed = ts - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var ease = easeInOut(progress);

      row.style.marginTop = (maxOverflow * ease) + 'px';
      row.style.marginBottom = (maxOverflow * ease) + 'px';

      if (info) {
        info.style.transform = 'translate(' + (-maxInfoShift * ease) + 'px, ' + (-maxOverflow * ease) + 'px)';
      }

      img.style.transform = 'scale(' + (1 + 0.62 * ease) + ')';
      img.style.filter = 'grayscale(' + (0.2 * (1 - ease)).toFixed(3) + ') brightness(' + (0.95 + 0.05 * ease).toFixed(3) + ')';

      if (progress < 1) {
        scrollAnimId = requestAnimationFrame(step);
      } else {
        if (scrolled) view.scrollTop = targetScroll;
        row.style.marginTop = maxOverflow + 'px';
        row.style.marginBottom = maxOverflow + 'px';
        if (info) info.style.transform = 'translate(' + (-maxInfoShift) + 'px, ' + (-maxOverflow) + 'px)';
        img.style.transform = 'scale(1.62)';
        img.style.filter = 'grayscale(0) brightness(1)';
        scrollAnimId = null;
      }
    }

    scrollAnimId = requestAnimationFrame(step);
  }

  function enlargeImg(img, shouldScroll) {
    if (!img) return;
    var isNew = !activeImg || activeImg !== img;

    if (isNew && activeImg && activeRow) {
      var oldImg = activeImg;
      var oldRow = activeRow;
      activeImg = null;
      activeRow = null;
      smoothShrink(oldRow, oldImg, ANIM_DURATION);
    }

    img.classList.add(ACTIVE_CLASS);
    activeImg = img;

    var row = img.closest('.proj-row');
    if (row && activeRow !== row) {
      row.classList.add(ACTIVE_ROW_CLASS);
      activeRow = row;
      var rowInfo = row.querySelector('.proj-info');
      if (rowInfo) rowInfo.style.zIndex = '2';
    }

    if (row && isNew) {
      smoothScrollToCenter(row, img, ANIM_DURATION, shouldScroll !== false);
    } else if (row && !isNew && shouldScroll !== false) {
      cancelScrollAnim();
      var target = computeCenteredScroll(img, 0);
      if (target > 0 || view.scrollTop > 0) view.scrollTop = target;
    }
  }

  // ---- multi-image switching ----

  function switchImage(row, newIdx) {
    var oldImg = getActiveImg(row);
    var newImg = getImgAt(row, newIdx);
    if (!oldImg || !newImg || oldImg === newImg) return;

    var wasEnlarged = oldImg.classList.contains(ACTIVE_CLASS);
    var oldRect = oldImg.getBoundingClientRect();
    if (oldRect.height === 0) return;

    // Lock new image height to match old image's natural height
    var scale = wasEnlarged ? 1.62 : 1;
    newImg.style.height = (oldRect.height / scale) + 'px';

    // Old image stays position:relative (keeps container sized)
    oldImg.classList.add('fading-out');
    oldImg.style.opacity = '1';

    // New image appears as absolute, overlapping old image
    newImg.classList.add('fading-in');
    newImg.style.opacity = '0';

    // Trigger crossfade (next frame after classes applied)
    requestAnimationFrame(function() {
      oldImg.style.opacity = '0';
      newImg.style.opacity = '1';
    });

    // Transfer enlarge state (old still has 'active' for container sizing)
    if (wasEnlarged) {
      oldImg.classList.remove(ACTIVE_CLASS);
      newImg.classList.add(ACTIVE_CLASS);
      newImg.style.transform = 'scale(1.62)';
      newImg.style.filter = 'grayscale(0) brightness(1)';
      activeImg = newImg;
    }

    // After crossfade (600ms), swap active and clean up
    setTimeout(function() {
      oldImg.classList.remove('active', 'fading-out');
      oldImg.style.opacity = '';
      oldImg.style.height = '';
      newImg.classList.remove('fading-in');
      newImg.classList.add('active');
      newImg.style.opacity = '';
      if (!wasEnlarged) newImg.style.height = '';

      if (wasEnlarged && activeImg === newImg) {
        var off = row._maxOverflow || 0;
        var t = computeCenteredScroll(newImg, off);
        if (t > 0 || view.scrollTop > 0) view.scrollTop = t;
      }
    }, 600);
  }

  // ---- visibility & center detection ----

  function isOutOfView(img) {
    if (!img || !img.classList.contains(ACTIVE_CLASS)) return false;
    var rect = img.getBoundingClientRect();
    var visibleTop = Math.max(0, rect.top);
    var visibleBottom = Math.min(window.innerHeight, rect.bottom);
    var visibleHeight = Math.max(0, visibleBottom - visibleTop);
    return visibleHeight < rect.height * 0.2;
  }

  var initialTrigger = true;
  var centerCheckTimer = null;

  function checkCenterRow(immediate) {
    if (immediate) {
      if (centerCheckTimer) clearTimeout(centerCheckTimer);
      checkCenterRowNow();
      return;
    }
    if (centerCheckTimer) clearTimeout(centerCheckTimer);
    centerCheckTimer = setTimeout(checkCenterRowNow, 200);
  }

  function checkCenterRowNow() {
    centerCheckTimer = null;
    if (scrollAnimId) return;
    var viewRect = view.getBoundingClientRect();
    var centerY = viewRect.top + viewRect.height / 2;
    var closestRow = null;
    var closestDist = Infinity;

    rows.forEach(function(row) {
      var img = getActiveImg(row);
      if (!img) return;
      var rect = img.getBoundingClientRect();
      var imgCenter = (rect.top + rect.bottom) / 2;
      var dist = Math.abs(imgCenter - centerY);
      if (dist < closestDist) { closestDist = dist; closestRow = row; }
    });

    if (!closestRow) { pendingRow = null; return; }

    if (pendingRow !== closestRow) {
      pendingRow = closestRow;
      var img = getActiveImg(closestRow);
      if (img) { enlargeImg(img, true); initialTrigger = false; }
    }
  }

  function updateState() {
    if (activeImg && isOutOfView(activeImg)) {
      var sr = activeRow;
      var si = activeImg;
      activeImg = null;
      activeRow = null;
      pendingRow = sr;
      smoothShrink(sr, si, ANIM_DURATION);
    }
    if (!shrinkAnimId) pendingRow = null;
    checkCenterRow(initialTrigger);
  }

  // ---- event handlers ----

  view.addEventListener('wheel', function(e) {
    // Horizontal swipe on enlarged image → switch to prev/next
    if (activeImg && activeRow && !scrollAnimId && !shrinkAnimId) {
      if (Math.abs(e.deltaX) > 15 && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.3) {
        e.preventDefault();
        var cur = getImgIndex(activeImg);
        var total = getImgCount(activeRow);
        var nxt = e.deltaX > 0 ? (cur + 1) % total : (cur - 1 + total) % total;
        switchImage(activeRow, nxt);
        return;
      }
    }

    if (scrollAnimId) {
      var row = activeRow;
      var img = activeImg;
      cancelScrollAnim();
      if (row && img) {
        var maxO = row._maxOverflow || (img.getBoundingClientRect().height * 0.31);
        var maxS = row._maxInfoShift || (img.getBoundingClientRect().width * 0.31);
        var info = row.querySelector('.proj-info');
        row.style.marginTop = maxO + 'px';
        row.style.marginBottom = maxO + 'px';
        if (info) info.style.transform = 'translate(' + (-maxS) + 'px, ' + (-maxO) + 'px)';
        img.style.transform = 'scale(1.62)';
        img.style.filter = 'grayscale(0) brightness(1)';
      }
    }
    requestAnimationFrame(updateState);
  }, { passive: false });

  // Click handler on all images
  rows.forEach(function(row) {
    row.querySelectorAll('.proj-img').forEach(function(img) {
      img.addEventListener('click', function(e) {
        if (scrollAnimId) return;
        if (img.classList.contains('fading-in') || img.classList.contains('fading-out')) return;

        if (activeImg === img) {
          // Enlarged → left half = prev, right half = next
          var rect = img.getBoundingClientRect();
          var isLeft = (e.clientX - rect.left) < rect.width / 2;
          var cur = getImgIndex(img);
          var total = getImgCount(row);
          var nxt = isLeft ? (cur - 1 + total) % total : (cur + 1) % total;
          switchImage(row, nxt);
        } else {
          cancelScrollAnim();
          enlargeImg(img);
        }
      });
    });
  });

  view.addEventListener('scroll', updateState);
  window.addEventListener('resize', function() {
    balanceRows();
    updateState();
  });

  view._init = function() {
    initialTrigger = true;
    pendingRow = null;
    if (activeImg && activeRow) resetImageState(activeRow, activeImg);
    if (shrinkingImg && shrinkingRow) resetImageState(shrinkingRow, shrinkingImg);
    activeImg = null;
    activeRow = null;
    shrinkingImg = null;
    shrinkingRow = null;
    balanceRows();
    updateState();
  };
})();

// ==================== 技与术 — 灯箱（图片 + 视频） ====================
(function() {
  // 图片灯箱
  var imgTrigger = document.querySelector('#view-technique .tool-card[data-lightbox]');
  var imgOverlay = document.getElementById('techLightbox');
  var imgClose = imgOverlay ? imgOverlay.querySelector('.lightbox-close') : null;

  if (imgTrigger && imgOverlay) {
    function openImg() {
      imgOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeImg() {
      imgOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }
    imgTrigger.addEventListener('click', openImg);
    imgClose.addEventListener('click', closeImg);
    imgOverlay.addEventListener('click', function(e) {
      if (e.target === imgOverlay) closeImg();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && imgOverlay.classList.contains('open')) closeImg();
    });
  }

  // 视频灯箱
  var vidTrigger = document.querySelector('#view-technique .tool-card[data-lightbox-video]');
  var vidOverlay = document.getElementById('techVideoLightbox');
  var vidClose = vidOverlay ? vidOverlay.querySelector('.lightbox-close') : null;
  var vidEl = vidOverlay ? vidOverlay.querySelector('video') : null;

  if (vidTrigger && vidOverlay && vidEl) {
    function openVid() {
      vidOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      vidEl.currentTime = 0;
      vidEl.load();
      var promise = vidEl.play();
      if (promise && promise.catch) {
        promise.catch(function() {
          // Retry once after load
          vidEl.load();
          vidEl.play().catch(function() {});
        });
      }
    }
    function closeVid() {
      vidOverlay.classList.remove('open');
      document.body.style.overflow = '';
      vidEl.pause();
      vidEl.currentTime = 0;
    }
    vidTrigger.addEventListener('click', openVid);
    vidClose.addEventListener('click', closeVid);
    vidOverlay.addEventListener('click', function(e) {
      if (e.target === vidOverlay) closeVid();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && vidOverlay.classList.contains('open')) closeVid();
    });
  }
})();
