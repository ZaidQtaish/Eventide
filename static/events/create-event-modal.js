(() => {
    function getModalMarkup() {
        return `
            <div id="create-event-modal" class="event-modal is-hidden" aria-hidden="true">
                <div class="event-modal-backdrop" data-close-modal="true"></div>
                <div class="event-modal-card panel" role="dialog" aria-modal="true" aria-labelledby="create-event-title">
                    <div class="panel-header">
                        <h3 id="create-event-title">Record Event</h3>
                        <button id="close-create-event-modal" class="cta-btn ghost event-modal-close" type="button" aria-label="Close event form">Close</button>
                    </div>

                    <form id="create-event-form" class="event-form-grid">
                        <div class="form-group">
                            <label for="event-type">Event Type</label>
                            <select id="event-type" class="form-control" required>
                                <option value="inbound">Inbound</option>
                                <option value="outbound">Outbound</option>
                                <option value="adjustment">Adjustment</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="event-item">Item</label>
                            <select id="event-item" class="form-control" required>
                                <option value="">Select item</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="event-warehouse">Warehouse</label>
                            <select id="event-warehouse" class="form-control" required>
                                <option value="">Select warehouse</option>
                                <option value="1">WH-CENTRAL</option>
                                <option value="2">WH-NORTH</option>
                                <option value="3">WH-SOUTH</option>
                                <option value="4">WH-EAST</option>
                                <option value="5">WH-WEST</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="event-qty">Quantity Change</label>
                            <input id="event-qty" class="form-control" type="number" required placeholder="e.g. 12 or -5" />
                        </div>

                        <div class="form-group">
                            <label for="event-reason">Reason Code</label>
                            <select id="event-reason" class="form-control" required>
                                <option value="">Select reason</option>
                                <option value="PURCHASE">PURCHASE</option>
                                <option value="SALE">SALE</option>
                                <option value="RETURN">RETURN</option>
                                <option value="DAMAGE">DAMAGE</option>
                                <option value="STOCK_CHECK">STOCK_CHECK</option>
                            </select>
                        </div>

                        <div class="event-form-actions">
                            <button id="create-event-btn" type="submit" class="cta-btn primary">Record Event</button>
                        </div>

                        <p id="event-form-message" class="form-message" aria-live="polite"></p>
                    </form>
                </div>
            </div>
        `;
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

    function mountCreateEventModal(config = {}) {
        const openButtonSelector = config.openButtonSelector || '#open-create-event-modal';
        const openModalBtn = document.querySelector(openButtonSelector);
        if (!openModalBtn) return null;

        if (!document.getElementById('create-event-modal')) {
            document.body.insertAdjacentHTML('beforeend', getModalMarkup());
        }

        const modal = document.getElementById('create-event-modal');
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
            const reasonCode = (formReason?.value || '').trim().toUpperCase();

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

                window.dispatchEvent(new CustomEvent('eventide:event-created'));
                window.dispatchEvent(new CustomEvent('eventide:events:refresh'));
                window.dispatchEvent(new CustomEvent('eventide:inventory:refresh'));

                if (typeof config.onSuccess === 'function') {
                    config.onSuccess(payload);
                }

                closeModal();
            } catch (err) {
                setFormMessage(err.message || 'Could not record event.', 'error');
            } finally {
                createBtn.disabled = false;
            }
        }

        openModalBtn.addEventListener('click', () => {
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

        populateItemOptions().catch((err) => {
            setFormMessage(err.message || 'Failed to initialize create event form.', 'error');
            console.error(err);
        });

        return { openModal, closeModal };
    }

    window.EventideCreateEventModal = {
        mount: mountCreateEventModal,
    };
})();
