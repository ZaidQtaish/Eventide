(() => {
    function parseErrorMessage(raw) {
        if (!raw) return 'Request failed.';
        try {
            const parsed = JSON.parse(raw);
            return parsed.error || parsed.message || raw;
        } catch {
            return raw;
        }
    }

    function mountItemModal(config = {}) {
        const openButtonSelector = config.openButtonSelector || '#add-new-item-btn';
        const openButton = document.querySelector(openButtonSelector);

        const modal = document.getElementById('create-item-modal');
        const closeBtn = document.getElementById('close-create-item-modal');
        const form = document.getElementById('create-item-form');
        const message = document.getElementById('create-item-message');
        const submitBtn = document.getElementById('create-item-submit');
        const title = document.getElementById('create-item-title');

        const itemNameInput = document.getElementById('item-name');
        const itemSkuInput = document.getElementById('item-sku');
        const itemCategoryInput = document.getElementById('item-category');
        const itemMinimumStockInput = document.getElementById('item-minimum-stock');
        const itemDescriptionInput = document.getElementById('item-description');
        const itemSupplierIDInput = document.getElementById('item-supplier-id');

        if (!modal || !form) return null;

        let editingItemID = null;

        function setMessage(text, kind = '') {
            if (!message) return;
            message.textContent = text;
            message.classList.remove('success', 'error');
            if (kind) message.classList.add(kind);
        }

        function openCreateItemModal() {
            editingItemID = null;
            if (title) title.textContent = 'Add New Item';
            if (submitBtn) submitBtn.textContent = 'Create Item';

            form.reset();
            if (itemMinimumStockInput) itemMinimumStockInput.value = '10';

            modal.classList.remove('is-hidden');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            setMessage('');
            itemNameInput?.focus();
        }

        function openEditItemModal(itemID) {
            const getItemByID = typeof config.getItemByID === 'function' ? config.getItemByID : null;
            const existing = getItemByID ? getItemByID(itemID) : null;

            if (!existing) {
                setMessage('Item not found for editing.', 'error');
                return;
            }

            editingItemID = itemID;
            if (title) title.textContent = 'Edit Item';
            if (submitBtn) submitBtn.textContent = 'Save Changes';

            if (itemNameInput) itemNameInput.value = existing.name || '';
            if (itemSkuInput) itemSkuInput.value = existing.sku || '';
            if (itemCategoryInput) itemCategoryInput.value = existing.category || '';
            if (itemMinimumStockInput) itemMinimumStockInput.value = Number.isFinite(existing.minimum_stock) ? String(existing.minimum_stock) : '10';
            if (itemDescriptionInput) itemDescriptionInput.value = existing.description || '';
            if (itemSupplierIDInput) itemSupplierIDInput.value = Number.isFinite(existing.supplier_id) ? String(existing.supplier_id) : '';

            modal.classList.remove('is-hidden');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            setMessage('');
            itemNameInput?.focus();
        }

        function closeCreateItemModal() {
            modal.classList.add('is-hidden');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
            setMessage('');
        }

        async function handleSubmit(event) {
            event.preventDefault();

            const name = (itemNameInput?.value || '').trim();
            const sku = (itemSkuInput?.value || '').trim();
            const category = (itemCategoryInput?.value || '').trim();
            const description = (itemDescriptionInput?.value || '').trim();
            const minimumStockValue = Number.parseInt(itemMinimumStockInput?.value || '10', 10);
            const supplierIDRaw = (itemSupplierIDInput?.value || '').trim();

            if (!name || !sku) {
                setMessage('Name and SKU are required.', 'error');
                return;
            }

            if (Number.isNaN(minimumStockValue) || minimumStockValue < 0) {
                setMessage('Minimum stock must be a non-negative number.', 'error');
                return;
            }

            let supplierID;
            if (supplierIDRaw) {
                const parsedSupplierID = Number.parseInt(supplierIDRaw, 10);
                if (Number.isNaN(parsedSupplierID) || parsedSupplierID <= 0) {
                    setMessage('Supplier ID must be a positive number.', 'error');
                    return;
                }
                supplierID = parsedSupplierID;
            }

            const payload = {
                name,
                sku,
                description,
                category,
                minimum_stock: minimumStockValue,
            };

            if (typeof supplierID === 'number') {
                payload.supplier_id = supplierID;
            }

            const isEditMode = Number.isFinite(editingItemID) && editingItemID > 0;
            const url = isEditMode ? `/api/items/${editingItemID}` : '/api/items';
            const method = isEditMode ? 'PUT' : 'POST';
            const pendingMessage = isEditMode ? 'Saving changes...' : 'Creating item...';
            const successMessage = isEditMode ? 'Item updated successfully.' : 'Item created successfully.';

            if (submitBtn) submitBtn.disabled = true;
            setMessage(pendingMessage);

            try {
                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const raw = await response.text();
                    throw new Error(parseErrorMessage(raw));
                }

                setMessage(successMessage, 'success');
                form.reset();
                if (itemMinimumStockInput) itemMinimumStockInput.value = '10';

                if (typeof config.onSuccess === 'function') {
                    await config.onSuccess();
                }

                setTimeout(() => {
                    closeCreateItemModal();
                }, 250);
            } catch (err) {
                const action = isEditMode ? 'update' : 'create';
                setMessage(`Failed to ${action} item: ${err.message}`, 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        }

        openButton?.addEventListener('click', openCreateItemModal);

        closeBtn?.addEventListener('click', closeCreateItemModal);

        modal.addEventListener('click', (event) => {
            const target = event.target;
            if (target instanceof HTMLElement && target.dataset.closeItemModal === 'true') {
                closeCreateItemModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modal.classList.contains('is-hidden')) {
                closeCreateItemModal();
            }
        });

        form.addEventListener('submit', handleSubmit);

        return {
            openCreateItemModal,
            openEditItemModal,
            closeCreateItemModal,
        };
    }

    window.EventideItemModal = {
        mount: mountItemModal,
    };
})();