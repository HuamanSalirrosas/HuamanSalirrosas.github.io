const portraitVideo = document.querySelector('.portrait-video');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (portraitVideo && !reducedMotion.matches) {
  portraitVideo.querySelectorAll('source[data-src]').forEach((source) => {
    source.src = source.dataset.src;
  });

  portraitVideo.addEventListener('canplay', () => {
    portraitVideo.classList.add('is-ready');
    portraitVideo.play().catch(() => {
      portraitVideo.classList.remove('is-ready');
    });
  }, { once: true });

  portraitVideo.addEventListener('error', () => {
    portraitVideo.classList.remove('is-ready');
  });

  portraitVideo.load();
}
