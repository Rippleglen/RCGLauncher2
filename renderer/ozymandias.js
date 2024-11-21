const { ipcRenderer } = require('electron');
const path = require('path');

document.addEventListener('DOMContentLoaded', () => {
  let heart = document.getElementById('player-heart');
  let entryText = document.getElementById('entry-text');
  let deleteBox = document.getElementById('delete-box');
  let saveBox = document.getElementById('save-box');
  let buttonContainer = document.getElementById('button-container');

  let heartPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const speed = 5;

  // Prepare sound effects with absolute paths
  const soundEffects = [
    new Audio(path.join(__dirname, '../assets/sound1.mp3')),
    new Audio(path.join(__dirname, '../assets/sound2.mp3')),
    new Audio(path.join(__dirname, '../assets/sound3.mp3')),
    new Audio(path.join(__dirname, '../assets/sound4.mp3')),
    new Audio(path.join(__dirname, '../assets/sound5.mp3')),
    new Audio(path.join(__dirname, '../assets/sound6.mp3')),
    new Audio(path.join(__dirname, '../assets/sound7.mp3')),
  ];

  // Background audio loaded similarly to sound effects
  const backgroundAudio = new Audio(path.join(__dirname, '../assets/background.mp3'));
  backgroundAudio.loop = true;
  backgroundAudio.volume = 0.3;

  // Play background audio
  backgroundAudio
    .play()
    .then(() => console.log('Background audio is playing.'))
    .catch((err) => console.error('Error playing background audio:', err));

  // Ensure sound effects have proper volume and independent playback
  soundEffects.forEach((audio) => {
    audio.volume = 0.8;
  });

  // Wingdings text
  const entryMessage = `
WOW... LOOK AT YOU....
YOU HAVE THE OLD LAUNCHER FILES
THANK-YOU FOR STICKING
WITH ME THROUGH ALL THESE ITERATIONS
I REALLY APPRECIATE IT!
DO YOU WANT TO DELETE OR SAVE THE OLD FILES?
`;
  let index = 0;

  // Typewriter effect with random shaking, rotation, and sound effects
  function typeWriterEffect() {
    if (index < entryMessage.length) {
      const charSpan = document.createElement('span');
      charSpan.textContent = entryMessage.charAt(index);
      charSpan.style.fontFamily = 'Wingdings';
      charSpan.classList.add('shaking-character');
      entryText.appendChild(charSpan);

      // Play a random sound effect
      const randomSound = soundEffects[Math.floor(Math.random() * soundEffects.length)];
      randomSound.pause();
      randomSound.currentTime = 0; // Reset playback
      randomSound.play().catch((err) => console.error('Error playing sound effect:', err));

      // Apply random shaking and rotation
      function applyRandomShake() {
        const randomX = Math.random() * 10 - 5; // Random horizontal movement
        const randomY = Math.random() * 10 - 5; // Random vertical movement
        const randomRotation = Math.random() * 25 - 12.5; // Random rotation
        charSpan.style.transform = `translate(${randomX}px, ${randomY}px) rotate(${randomRotation}deg)`;
        requestAnimationFrame(applyRandomShake); // Continuously update for unique shaking
      }

      applyRandomShake(); // Start the shaking effect for this character

      index++;
      setTimeout(typeWriterEffect, 100 + Math.random() * 100); // Adjust typing speed with randomness
    } else {
      // After text animation, show buttons and heart with fade-in effect
      fadeInElement(buttonContainer);
      fadeInElement(heart);
    }
  }
  typeWriterEffect();

  // Function to fade in elements
  function fadeInElement(element) {
    element.style.opacity = 0;
    element.style.display = 'flex'; // Ensure the element is visible
    let opacity = 0;
    const fadeIn = setInterval(() => {
      opacity += 0.05;
      element.style.opacity = opacity;
      if (opacity >= 1) {
        clearInterval(fadeIn);
      }
    }, 50); // Adjust fade-in speed
  }

  // Move heart with WASD keys
  document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
      case 'w':
        heartPosition.y -= speed;
        break;
      case 'a':
        heartPosition.x -= speed;
        break;
      case 's':
        heartPosition.y += speed;
        break;
      case 'd':
        heartPosition.x += speed;
        break;
    }

    heart.style.left = `${heartPosition.x}px`;
    heart.style.top = `${heartPosition.y}px`;

    // Check collision with action boxes
    checkCollision();
  });

  function checkCollision() {
    const heartRect = heart.getBoundingClientRect();
    const deleteRect = deleteBox.getBoundingClientRect();
    const saveRect = saveBox.getBoundingClientRect();

    if (isColliding(heartRect, deleteRect)) {
      backgroundAudio.pause(); // Stop background sound on action
      ipcRenderer.send('remove-old-launcher-folder');
    } else if (isColliding(heartRect, saveRect)) {
      backgroundAudio.pause(); // Stop background sound on action
      ipcRenderer.send('skip-old-launcher-folder');
    }
  }

  function isColliding(rect1, rect2) {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }
});
