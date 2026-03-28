(() => {
    const modal = document.getElementById('create-event-modal');
    const openModalBtn = document.getElementById('open-create-event-modal');
    const closeModalBtn = document.getElementById('close-create-event-modal');
    const createForm = document.getElementById('create-event-form');
    const createBtn = document.getElementById('create-event-btn');
    const formType = document.getElementById('event-type');
    const formItem = document.getElementById('event-item');
    const formWarehouse = document.getElementById('event-warehouse');
    const formQty = document.getElementById('event-qty');
    const formReason = document.getElementById('event-reason');
    const formMessage = document.getElementById('event-form-message');

    function openModal() {
        if (!modal) return;
        modal.classList.remove('is-hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        setTimeout(() => formType?.focus(), 0);
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.add('is-hidden');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    }

    function setFormMessage(message, kind = '') {
        if (!formMessage) return;
        formMessage.textContent = message;
        formMessage.classList.remove('success', 'error');
        if (kind) formMessage.classList.add(kind);
    }

    function parseErrorMessage(raw) {
        if (!raw) return 'Failed to record event.';
        try {
            const parsed = JSON.parse(raw);
            return parsed.error || parsed.message || raw;
        } catch {
            return raw;
        }
    }

    async function populateItemOptions() {
        if (!formItem) return;
        try {
            const res = await fetch('/items');
            if (!res.ok) throw new Error('Could not load items');
            const items = await res.json();

            formItem.innerHTML = '<option value="">Select item</option>';
            items.forEach((item) => {
                const option = document.createElement('option');
                option.value = item.item_id;
                option.textContent = `${item.name} (${item.sku})`;
                formItem.appendChild(option);
            });
        } catch (err) {
            setFormMessage(err.message || 'Unable to load items.', 'error');
        }
    }

    async function onCreateEventSubmit(e) {
        e.preventDefault();
        if (!createForm || !createBtn) return;

        const eventType = (formType?.value || '').toLowerCase();
        let reasonCode = (formReason?.value || '').trim().toUpperCase();

        if (!reasonCode) {
            setFormMessage('Please choose a reason code.', 'error');
            return;
        }

        const payload = {
            type: eventType,
            item_id: Number(formItem?.value || 0),
            warehouse_id: Number(formWarehouse?.value || 0),
            quantity_change: Number(formQty?.value || 0),
            reason_code: reasonCode,
        };

        if (eventType === 'inbound' || eventType === 'outbound') {
            payload.quantity_change = Math.abs(payload.quantity_change);
        }

        createBtn.disabled = true;
        setFormMessage('Recording event...');

        try {
            const res = await fetch('/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const raw = await res.text();
                throw new Error(parseErrorMessage(raw));
            }

            setFormMessage('Event recorded successfully.', 'success');
            createForm.reset();
            if (formType) formType.value = 'inbound';
            if (formReason) formReason.value = '';

            // Notify listing script to refresh event rows.
            window.dispatchEvent(new CustomEvent('eventide:events:refresh'));
            closeModal();
        } catch (err) {
            setFormMessage(err.message || 'Could not record event.', 'error');
        } finally {
            createBtn.disabled = false;
        }
    }

    function bindCreateEvents() {
        openModalBtn?.addEventListener('click', () => {
            setFormMessage('');
            openModal();
        });

        closeModalBtn?.addEventListener('click', closeModal);

        modal?.addEventListener('click', (e) => {
            const target = e.target;
            if (target instanceof Element && target.hasAttribute('data-close-modal')) {
                closeModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('is-hidden')) {
                closeModal();
            }
        });

        createForm?.addEventListener('submit', onCreateEventSubmit);
    }

    async function initCreateEvent() {
        bindCreateEvents();
        await populateItemOptions();
    }

    initCreateEvent().catch((err) => {
        setFormMessage(err.message || 'Failed to initialize create event form.', 'error');
        console.error(err);
    });
})();
