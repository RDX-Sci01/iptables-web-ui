const loginForm = document.getElementById('loginForm');
const loginBtn = loginForm.querySelector('button[type="submit"]');
const loginMessage = document.getElementById('loginMessage');

loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const data = new FormData(loginForm);
    const loginUrl = new URL('./api/login', window.location.href);

    let res = await fetch(loginUrl, {
        method: 'POST',
        headers: new Headers({'Content-Type': 'application/json'}),
        body: JSON.stringify({password: data.get('password')})
    });
    if(!res.ok) throw new Error('Request failed with status: '+res.status);
    res = await res.json();
    if(res.success) {
        const returnUrl = new URL('./', window.location.href);
        returnUrl.search = window.location.search;
        returnUrl.hash = window.location.hash;
        window.location.replace(returnUrl.toString());
    } else {
        loginMessage.classList.remove('d-none');
        loginForm.reset();
        loginBtn.disabled = true;
    }
});

loginForm.addEventListener('input', () => {
    loginBtn.disabled = !loginForm.checkValidity();
});
