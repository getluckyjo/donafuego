// Scroll-reveal
(function () {
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      // reveal when entering view, or if already scrolled past
      if (e.isIntersecting || e.boundingClientRect.top < 0) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px 60px 0px' });
  els.forEach(function (el) { io.observe(el); });
})();
