const portrait = document.querySelector('.magic-portrait');

if (portrait && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  portrait.addEventListener('pointermove', (event) => {
    const bounds = portrait.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;

    portrait.style.setProperty('--tilt-x', `${-y * 9}deg`);
    portrait.style.setProperty('--tilt-y', `${x * 11}deg`);
  });

  portrait.addEventListener('pointerleave', () => {
    portrait.style.setProperty('--tilt-x', '0deg');
    portrait.style.setProperty('--tilt-y', '0deg');
  });
}
