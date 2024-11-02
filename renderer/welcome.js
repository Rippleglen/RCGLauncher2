// renderer/welcome.js
const { ipcRenderer } = require('electron');

document.getElementById('login-button').addEventListener('click', async () => {
  try {
    const mcProfile = await ipcRenderer.invoke('msft-login');
    console.log('Login successful:', mcProfile);

    // Send request to load landing.ejs
    ipcRenderer.send('load-landing-page');
  } catch (error) {
    console.error('Login failed:', error);
    alert('Login failed: ' + error.message);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const meteorContainer = document.body;

  function createMeteor() {
    const meteor = document.createElement("div");
    meteor.classList.add("meteor");

    // Randomize meteor position and animation duration
    const randomLeft = Math.random() * window.innerWidth + "px";
    const randomDuration = Math.random() * 1 + 0.5 + "s"; // 0.5s to 1.5s

    meteor.style.left = randomLeft;
    meteor.style.animationDuration = randomDuration;
    meteorContainer.appendChild(meteor);

    // Remove the meteor after the animation ends
    meteor.addEventListener("animationend", () => {
      meteorContainer.removeChild(meteor);
    });
  }

  // Generate meteors at intervals
  setInterval(createMeteor, 50);
});
