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
	let isAdminUser = false;
	let userModalApi = null;

	async function loadSessionRole() {
		let currentRole = '';
		try {
			const res = await fetch('/api/session');
			if (!res.ok) return;
			const payload = await res.json();
			currentRole = String(payload.role || '').trim().toLowerCase();
		} catch {
			currentRole = '';
		}

		if (openCreateUserBtn) {
			isAdminUser = currentRole === 'admin';
			openCreateUserBtn.hidden = !isAdminUser;
			if (isAdminUser) {
				userModalApi = window.EventideCreateUserModal?.mount({
					openButtonSelector: '#open-create-user-modal',
					getUserByID: (userID) => {
						const normalized = cachedUsers.map(normalizeUser);
						return normalized.find((u) => Number(u.id) === Number(userID)) || null;
					},
					onSuccess: () => {
						window.dispatchEvent(new CustomEvent('eventide:users:refresh'));
					},
				}) || null;
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
			const editButton = isAdminUser
				? `<button class="cta-btn ghost item-edit-btn user-edit-btn" type="button" data-user-id="${user.id}">Edit</button>`
				: '';

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
					${editButton}
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

		list?.addEventListener('click', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const button = target.closest('.user-edit-btn');
			if (!(button instanceof HTMLElement)) return;

			const userID = Number.parseInt(button.dataset.userId || '', 10);
			if (!Number.isFinite(userID)) return;

			userModalApi?.openEditUserModal(userID);
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
