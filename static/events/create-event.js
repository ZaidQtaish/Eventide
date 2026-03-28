(() => {
    if (!window.EventideCreateEventModal || typeof window.EventideCreateEventModal.mount !== 'function') {
        console.error('Create event modal component is not available.');
        return;
    }

    window.EventideCreateEventModal.mount({
        openButtonSelector: '#open-create-event-modal',
    });
})();
