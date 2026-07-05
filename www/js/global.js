const toastContainer = document.getElementById('toastContainer');

// HTML escape function to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// URL parameter encoding
function encodeParam(value) {
    return encodeURIComponent(value);
}

function showError(message) {
    // Sanitize error messages - only show first 200 chars to prevent info disclosure
    const sanitizedMessage = message.substring(0, 200);
    showToast({
        message: '<b>An error occurred:</b><br>' + escapeHtml(sanitizedMessage),
        type: 'danger',
        width: '500px'
    });
}

function showToast(data) {
    let toastElement = document.createElement('div');
    toastElement.className = `toast align-items-center border-0 mb-2 text-bg-${data.type || 'secondary'}`;
    
    const toastBody = document.createElement('div');
    toastBody.className = 'd-flex';
    
    const bodyContent = document.createElement('div');
    bodyContent.className = 'toast-body';
    bodyContent.innerHTML = data.message;
    
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close btn-close-white me-2 m-auto';
    closeBtn.setAttribute('data-bs-dismiss', 'toast');
    
    toastBody.appendChild(bodyContent);
    toastBody.appendChild(closeBtn);
    toastElement.appendChild(toastBody);
    
    if(data.width) toastElement.style.width = data.width;
    toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
    toastContainer.appendChild(toastElement);
    new bootstrap.Toast(toastElement).show();
}

function showModal(data) {
    return new Promise(resolve => {
        const modalDiv = document.createElement('div');
        modalDiv.className = 'modal';
        modalDiv.setAttribute('tabindex', '-1');
        
        const dialogDiv = document.createElement('div');
        dialogDiv.className = 'modal-dialog';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'modal-content';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'modal-header';
        
        const titleEl = document.createElement('h5');
        titleEl.className = 'modal-title';
        titleEl.textContent = data.title;
        
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-close';
        closeBtn.setAttribute('data-bs-dismiss', 'modal');
        
        headerDiv.appendChild(titleEl);
        headerDiv.appendChild(closeBtn);
        
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'modal-body';
        bodyDiv.innerHTML = data.body;
        
        const footerDiv = document.createElement('div');
        footerDiv.className = 'modal-footer';
        
        const footerCloseBtn = document.createElement('button');
        footerCloseBtn.type = 'button';
        footerCloseBtn.className = 'btn btn-secondary';
        footerCloseBtn.setAttribute('data-bs-dismiss', 'modal');
        footerCloseBtn.textContent = 'Close';
        
        const acceptBtn = document.createElement('button');
        acceptBtn.type = 'button';
        acceptBtn.className = `btn btn-${data.type || 'primary'} acceptBtn`;
        acceptBtn.textContent = data.acceptText || 'Confirm';
        
        footerDiv.appendChild(footerCloseBtn);
        footerDiv.appendChild(acceptBtn);
        
        contentDiv.appendChild(headerDiv);
        contentDiv.appendChild(bodyDiv);
        contentDiv.appendChild(footerDiv);
        
        dialogDiv.appendChild(contentDiv);
        modalDiv.appendChild(dialogDiv);
        
        const modal = new bootstrap.Modal(modalDiv);
        document.body.appendChild(modalDiv);
        if(data.onInit) data.onInit({modal, modalElement: modalDiv, acceptBtn});

        acceptBtn.addEventListener('click', () => {
            const status = {accept: true, inputs: {}};
            modalDiv.querySelectorAll('.modal-body input[name]').forEach(input => {
                status.inputs[input.name] = input.value;
            });
            resolve(status);
            modal.hide();
        });
        modalDiv.addEventListener('hidden.bs.modal', () => {
            modalDiv.remove();
            resolve({accept: false});
        });
        modal.show();
    });
}