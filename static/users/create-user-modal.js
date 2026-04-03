(() => {
    function getModalMarkup() {
        return `
            <div id="create-user-modal" class="event-modal is-hidden" aria-hidden="true">
                <div class="event-modal-backdrop" data-close-modal="true"></div>
                <div class="event-modal-card panel" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
                    <div class="panel-header">
                        <h3 id="create-user-title">Create User</h3>
                        <button id="close-create-user-modal" class="cta-btn ghost event-modal-close" type="button" aria-label="Close user form">Close</button>
                    </div>

                    <form id="create-user-form" class="event-form-grid">
                        <div class="form-group">
                            <label for="new-user-name">Name</label>
                            <input id="new-user-name" class="form-control" type="text" required placeholder="Jane Doe" />
                        </div>

                        <div class="form-group">
                            <label for="new-user-username">Username</label>
                            <input id="new-user-username" class="form-control" type="text" required placeholder="jane" />
                        </div>

                        <div class="form-group">
                            <label for="new-user-password">Password</label>
                            <input id="new-user-password" class="form-control" type="password" required placeholder="Minimum 6 chars" minlength="6" />
                        </div>

                        <div class="form-group">
                            <label for="new-user-role">Role</label>
                            <select id="new-user-role" class="form-control" required>
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="new-user-phone">Phone</label>
                            <input id="new-user-phone" class="form-control" type="text" required placeholder="+1 555 123 4567" />
                        </div>

                        <div class="event-form-actions">
                            <button id="create-user-btn" type="submit" class="cta-btn primary">Create User</button>
                        </div>

                        <p id="create-user-message" class="form-message" aria-live="polite"></p>
                    </form>
                </div>
            </div>
        `;
    }

    function parseErrorMessage(raw) {
        if (!raw) return 'Request failed.';
        try {
            const parsed = JSON.parse(raw);
            return parsed.error || parsed.message || raw;
        } catch {
            return raw;
        }
    }

    function mountCreateUserModal(config = {}) {
        const openButtonSelector = config.openButtonSelector || '#open-create-user-modal';
        const openModalBtn = document.querySelector(openButtonSelector);
        if (!openModalBtn) return null;

        if (!document.getElementById('create-user-modal')) {
            document.body.insertAdjacentHTML('beforeend', getModalMarkup());
        }

        const modal = document.getElementById('create-user-modal');
        const closeModalBtn = document.getElementById('close-create-user-modal');
        const form = document.getElementById('create-user-form');
        const submitBtn = document.getElementById('create-user-btn');
        const messageEl = document.getElementById('create-user-message');
        const titleEl = document.getElementById('create-user-title');
        const nameInput = document.getElementById('new-user-name');
        const usernameInput = document.getElementById('new-user-username');
        const passwordInput = document.getElementById('new-user-password');
        const roleInput = document.getElementById('new-user-role');
        const phoneInput = document.getElementById('new-user-phone');

        let editingUserID = null;

        function setFormMessage(msg, kind = '') {
            if (!messageEl) return;
            messageEl.textContent = msg;
            messageEl.classList.remove('success', 'error');
            if (kind) messageEl.classList.add(kind);
        }

        function openModal() {
            if (!modal) return;
            modal.classList.remove('is-hidden');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            setTimeout(() => {
                nameInput?.focus();
            }, 0);
        }

        function closeModal() {
            if (!modal) return;
            modal.classList.add('is-hidden');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
        }

        function openCreateUserModal() {
            editingUserID = null;
            if (titleEl) titleEl.textContent = 'Create User';
            if (submitBtn) submitBtn.textContent = 'Create User';
            if (passwordInput) {
                passwordInput.required = true;
                passwordInput.placeholder = 'Minimum 6 chars';
            }
            if (phoneInput) {
                phoneInput.required = true;
            }

            form?.reset();
            setFormMessage('');
            openModal();
        }

        function openEditUserModal(userID) {
            const getUserByID = typeof config.getUserByID === 'function' ? config.getUserByID : null;
            const user = getUserByID ? getUserByID(userID) : null;
            if (!user) {
                setFormMessage('User not found for editing.', 'error');
                return;
            }

            editingUserID = Number(userID);
            if (titleEl) titleEl.textContent = 'Edit User';
            if (submitBtn) submitBtn.textContent = 'Save Changes';

            if (nameInput) nameInput.value = user.name || '';
            if (usernameInput) usernameInput.value = user.username || '';
            if (roleInput) roleInput.value = user.role || 'staff';
            if (phoneInput) phoneInput.value = user.phone_number || '';
            if (passwordInput) {
                passwordInput.value = '';
                passwordInput.required = false;
                passwordInput.placeholder = 'Leave blank to keep existing password';
            }

            setFormMessage('');
            openModal();
        }

        async function onSubmit(e) {
            e.preventDefault();

            const name = String(nameInput?.value || '').trim();
            const username = String(usernameInput?.value || '').trim();
            const password = String(passwordInput?.value || '').trim();
            const role = String(roleInput?.value || '').trim().toLowerCase();
            const phone = String(phoneInput?.value || '').trim();
            const isEditMode = Number.isFinite(editingUserID) && editingUserID > 0;

            if (!name || !username || !role || !phone) {
                setFormMessage('Name, username, role, and phone are required.', 'error');
                return;
            }

            if (!isEditMode && password.length < 6) {
                setFormMessage('Password must be at least 6 characters.', 'error');
                return;
            }

            if (isEditMode && password && password.length < 6) {
                setFormMessage('Password must be at least 6 characters.', 'error');
                return;
            }

            if (submitBtn) submitBtn.disabled = true;
            setFormMessage(isEditMode ? 'Saving changes...' : 'Creating user...');

            const payload = {
                name,
                username,
                role,
                phone_number: phone,
            };

            if (!isEditMode || password) {
                payload.password = password;
            }

            try {
                const res = await fetch(isEditMode ? `/api/users/${editingUserID}` : '/api/users', {
                    method: isEditMode ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const raw = await res.text();
                    throw new Error(parseErrorMessage(raw));
                }

                setFormMessage(isEditMode ? 'User updated successfully.' : 'User created successfully.', 'success');
                form?.reset();

                if (typeof config.onSuccess === 'function') {
                    config.onSuccess();
                }

                closeModal();
            } catch (err) {
                setFormMessage(err.message || 'Could not create user.', 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        }

        openModalBtn.addEventListener('click', openCreateUserModal);

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

        form?.addEventListener('submit', onSubmit);

        return {
            openCreateUserModal,
            openEditUserModal,
            closeModal,
        };
    }

    window.EventideCreateUserModal = {
        mount: mountCreateUserModal,
    };
})();