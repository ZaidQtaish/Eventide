(() => {
	const form = document.querySelector('form');
	if (!form) return;

	const usernameInput = form.querySelector('#username');
	const passwordInput = form.querySelector('#password');
	const submitBtn = form.querySelector('button[type="submit"]');
	const messageEl = document.getElementById('auth-message');

	const setMessage = (text, type) => {
		if (!messageEl) return;
		messageEl.textContent = text;
		messageEl.className = `auth-message${type ? ` ${type}` : ''}`;
	};

	const setLoading = (isLoading) => {
		if (!submitBtn) return;
		submitBtn.disabled = isLoading;
		submitBtn.textContent = isLoading ? 'Signing in...' : 'Sign In';
	};

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		setMessage('', '');
		setLoading(true);

		const username = usernameInput?.value.trim() || '';
		const password = passwordInput?.value || '';

		try {
			const res = await fetch('/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});

			if (res.ok) {
				setMessage('Login successful. Redirecting...', 'success');
				setTimeout(() => { window.location.href = '/'; }, 600);
				return;
			}

			const text = await res.text();
			setMessage(text || 'Invalid credentials', 'error');
		} catch (err) {
			setMessage('Network error. Please try again.', 'error');
		} finally {
			setLoading(false);
		}
	});
})();
