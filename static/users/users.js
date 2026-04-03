(() => {
	const list = document.getElementById('users-list');
	const roleFilter = document.getElementById('users-role-filter');
	const searchFilter = document.getElementById('users-search-filter');
	const clearFilterBtn = document.getElementById('users-clear-filter');
	const openCreateUserBtn = document.getElementById('open-create-user-modal');

	const totalCountEl = document.getElementById('users-total-count');
	const adminCountEl = document.getElementById('users-admin-count');
	const staffCountEl = document.getElementById('users-staff-count');
	const shownCountEl = document.getElementById('users-shown-count');

	let cachedUsers = [];
	let currentRole = '';

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
							<label for="new-user-phone">Phone (optional)</label>
							<input id="new-user-phone" class="form-control" type="text" placeholder="+1 555 123 4567" />
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
		if (!raw) return 'Failed to create user.';
		try {
			const parsed = JSON.parse(raw);
			return parsed.error || parsed.message || raw;
		} catch {
			return raw;
		}
	}

	function setFormMessage(msg, kind = '') {
		const el = document.getElementById('create-user-message');
		if (!el) return;
		el.textContent = msg;
		el.classList.remove('success', 'error');
		if (kind) el.classList.add(kind);
	}

	function openCreateModal() {
		const modal = document.getElementById('create-user-modal');
		if (!modal) return;
		modal.classList.remove('is-hidden');
		modal.setAttribute('aria-hidden', 'false');
		document.body.classList.add('modal-open');
		setTimeout(() => {
			document.getElementById('new-user-name')?.focus();
		}, 0);
	}

	function closeCreateModal() {
		const modal = document.getElementById('create-user-modal');
		if (!modal) return;
		modal.classList.add('is-hidden');
		modal.setAttribute('aria-hidden', 'true');
		document.body.classList.remove('modal-open');
	}

	function ensureCreateUserModal() {
		if (document.getElementById('create-user-modal')) return;
		document.body.insertAdjacentHTML('beforeend', getModalMarkup());

		document.getElementById('close-create-user-modal')?.addEventListener('click', closeCreateModal);
		document.getElementById('create-user-modal')?.addEventListener('click', (e) => {
			const target = e.target;
			if (target instanceof Element && target.hasAttribute('data-close-modal')) {
				closeCreateModal();
			}
		});

		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				const modal = document.getElementById('create-user-modal');
				if (modal && !modal.classList.contains('is-hidden')) closeCreateModal();
			}
		});

		document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
			e.preventDefault();

			const btn = document.getElementById('create-user-btn');
			const name = String(document.getElementById('new-user-name')?.value || '').trim();
			const username = String(document.getElementById('new-user-username')?.value || '').trim();
			const password = String(document.getElementById('new-user-password')?.value || '').trim();
			const role = String(document.getElementById('new-user-role')?.value || '').trim().toLowerCase();
			const phone = String(document.getElementById('new-user-phone')?.value || '').trim();

			if (!name || !username || !password || !role) {
				setFormMessage('All required fields must be filled.', 'error');
				return;
			}

			if (password.length < 6) {
				setFormMessage('Password must be at least 6 characters.', 'error');
				return;
			}

			if (btn) btn.disabled = true;
			setFormMessage('Creating user...');

			try {
				const res = await fetch('/api/users', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name,
						username,
						password,
						role,
						phone_number: phone,
					}),
				});

				if (!res.ok) {
					const raw = await res.text();
					throw new Error(parseErrorMessage(raw));
				}

				setFormMessage('User created successfully.', 'success');
				document.getElementById('create-user-form')?.reset();
				window.dispatchEvent(new CustomEvent('eventide:users:refresh'));
				closeCreateModal();
			} catch (err) {
				setFormMessage(err.message || 'Could not create user.', 'error');
			} finally {
				if (btn) btn.disabled = false;
			}
		});
	}

	async function loadSessionRole() {
		try {
			const res = await fetch('/api/session');
			if (!res.ok) return;
			const payload = await res.json();
			currentRole = String(payload.role || '').trim().toLowerCase();
		} catch {
			currentRole = '';
		}

		if (openCreateUserBtn) {
			const isAdmin = currentRole === 'admin';
			openCreateUserBtn.hidden = !isAdmin;
			if (isAdmin) {
				ensureCreateUserModal();
				openCreateUserBtn.addEventListener('click', () => {
					setFormMessage('');
					openCreateModal();
				});
			}
		}
	}

	function normalizeUser(user) {
		return {
			id: Number(user.id ?? user.ID ?? 0),
			username: String(user.username ?? user.Username ?? '').trim(),
			name: String(user.name ?? user.Name ?? '').trim(),
			role: String(user.role ?? user.Role ?? 'staff').trim().toLowerCase(),
		};
	}

	function initialsFor(user) {
		const source = user.name || user.username || 'U';
		const parts = source.split(/\s+/).filter(Boolean);
		const first = (parts[0] || source[0] || 'U').slice(0, 1).toUpperCase();
		const second = (parts[1] || '').slice(0, 1).toUpperCase();
		return `${first}${second}`;
	}

	function updateStats(allUsers, shownUsers) {
		const admins = allUsers.filter((u) => u.role === 'admin').length;
		const staff = allUsers.length - admins;

		if (totalCountEl) totalCountEl.textContent = String(allUsers.length);
		if (adminCountEl) adminCountEl.textContent = String(admins);
		if (staffCountEl) staffCountEl.textContent = String(staff);
		if (shownCountEl) shownCountEl.textContent = String(shownUsers.length);
	}

	function matchesFilters(user) {
		const selectedRole = String(roleFilter?.value || '').trim().toLowerCase();
		const query = String(searchFilter?.value || '').trim().toLowerCase();

		if (selectedRole && user.role !== selectedRole) return false;

		if (!query) return true;

		const haystack = [user.username, user.name, user.role]
			.map((v) => String(v || '').toLowerCase())
			.join(' ');

		return haystack.includes(query);
	}

	function render(users) {
		if (!list) return;

		if (!users || users.length === 0) {
			list.innerHTML = '<p class="loading">No users found.</p>';
			updateStats([], []);
			return;
		}

		const normalized = users.map(normalizeUser);
		const filtered = normalized.filter(matchesFilters);

		updateStats(normalized, filtered);

		if (filtered.length === 0) {
			list.innerHTML = '<p class="loading">No users match current filters.</p>';
			return;
		}

		list.innerHTML = '';
		filtered.forEach((user) => {
			const card = document.createElement('article');
			card.className = 'user-card';
			const roleClass = user.role === 'admin' ? 'admin' : 'staff';
			const roleLabel = user.role || 'staff';

			card.innerHTML = `
				<div class="user-head">
					<div class="user-avatar" aria-hidden="true">${initialsFor(user)}</div>
					<div class="user-title">
						<div class="user-name">${user.name || 'Unnamed user'}</div>
						<div class="user-username">@${user.username || 'unknown'}</div>
					</div>
				</div>
				<div class="user-meta">
					<span class="role-pill ${roleClass}">${roleLabel}</span>
				</div>
			`;

			list.appendChild(card);
		});
	}

	async function loadUsers() {
		if (list) list.innerHTML = '<p class="loading">Loading users...</p>';

		const res = await fetch('/api/users');
		if (!res.ok) {
			throw new Error((await res.text()) || 'Failed to load users');
		}

		cachedUsers = await res.json();
		render(cachedUsers);
	}

	function bindEvents() {
		const rerender = () => render(cachedUsers);

		roleFilter?.addEventListener('change', rerender);
		searchFilter?.addEventListener('input', rerender);

		clearFilterBtn?.addEventListener('click', () => {
			if (roleFilter) roleFilter.value = '';
			if (searchFilter) searchFilter.value = '';
			render(cachedUsers);
		});

		window.addEventListener('eventide:users:refresh', () => {
			loadUsers().catch((err) => {
				if (list) list.innerHTML = `<p class="loading">Error loading users: ${err.message}</p>`;
			});
		});
	}

	function init() {
		bindEvents();
		Promise.all([loadSessionRole(), loadUsers()]).catch((err) => {
			if (list) list.innerHTML = `<p class="loading">Error loading users: ${err.message}</p>`;
			updateStats([], []);
		});
	}

	init();
})();
