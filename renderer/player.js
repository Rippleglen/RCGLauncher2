document.addEventListener("DOMContentLoaded", () => {
    const iframe = document.getElementById('soundcloud-player');
    const widget = SC.Widget(iframe);

    // Adjust volume to 50% when the widget is ready
    widget.bind(SC.Widget.Events.READY, () => {
        console.log('SoundCloud Player Ready');
        widget.setVolume(40); // Volume range is 0 to 100
    });

    // Optional: Play event
    widget.bind(SC.Widget.Events.PLAY, () => {
        console.log('SoundCloud Player is playing');
    });

    // Optional: Error handling
    widget.bind(SC.Widget.Events.ERROR, (e) => {
        console.error('SoundCloud Player Error:', e);
    });
});
