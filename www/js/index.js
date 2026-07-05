const logoutBtn = document.getElementById('logoutBtn');
const loadRulesBtn = document.getElementById('loadRulesBtn');
const saveRulesBtn = document.getElementById('saveRulesBtn');
const rulesTable = document.querySelector('#rulesTable tbody');
const addRuleForm = document.getElementById('addRuleForm');
const saveChainToggle = document.getElementById('saveChainToggle');
const currentChainElement = document.getElementById('currentChain');

let currentChain, defaultChain;
let chains = {};
let numRules = 0;

// Chains
async function switchChain(id) {
    currentChain = chains[id];
    updateChainInfo();
    await loadRules();
}

function updateChainInfo() {
    document.getElementById('currentTable').innerText = currentChain.table;
    document.getElementById('currentIPversion').innerText = currentChain.ip6 ? 'IPv6' : 'IPv4';
    currentChainElement.innerText = currentChain.name;
    currentChainElement.dataset.edit = 'false';
    document.getElementById('currentChainActions').style.display = currentChain.system ? 'none' : null;
    const defaultPolicyElement = document.getElementById('currentChainDefaultPolicy'), defaultPolicySelect = defaultPolicyElement.querySelector('select');
    defaultPolicyElement.style.display = (currentChain.system && currentChain.table == 'filter') ? null : 'none';
    defaultPolicySelect.value = currentChain.defaultPolicy;
    defaultPolicySelect.setAttribute('style', `color: rgb(var(--bs-${currentChain.defaultPolicy == 'ACCEPT' ? 'success' : 'danger'}-rgb)) !important`);
    saveChainToggle.checked = !currentChain.dynamic;
}

async function loadChains() {
    for(const element of document.querySelectorAll('#chainSelect [data-table]')) {
        const table = element.dataset.table;
        const ip6 = element.dataset.ip6 == 'true';
    
        let res = await fetch(`/api/chain?table=${encodeParam(table)}&ip6=${ip6}`);
        if(res.status == 500) throw new Error(await res.text());
        if(!res.ok) throw new Error('Request failed with status: '+res.status);
        res = await res.json();
        defaultChain = res.defaultChain;
        
        const dropdownMenu = element.querySelector('.dropdown-menu');
        dropdownMenu.innerHTML = '';
        
        res.chains.forEach(chain => {
            chain.table = table;
            chain.ip6 = ip6;
            const chainId = ip6+'-'+table+'-'+chain.name;
            chains[chainId] = chain;
            
            const li = document.createElement('li');
            const div = document.createElement('div');
            div.className = `dropdown-item curs-pointer ${chain.system ? 'fw-bold' : ''}`;
            div.textContent = chain.name;
            div.addEventListener('click', () => switchChain(chainId));
            li.appendChild(div);
            dropdownMenu.appendChild(li);
        });
    
        const li = document.createElement('li');
        const div = document.createElement('div');
        div.className = 'dropdown-item curs-pointer';
        div.textContent = '[New Chain]';
        div.addEventListener('click', () => showCreateChainModal(table, ip6));
        li.appendChild(div);
        dropdownMenu.appendChild(li);
    }

    if(!currentChain) await switchChain(defaultChain);
}

document.querySelector('#currentChainActions .transparentEditBtn').addEventListener('click', () => {
    if(currentChain.system) return;
    if(currentChainElement.dataset.edit == 'true') {
        currentChainElement.dataset.edit = 'false';
        currentChainElement.innerText = currentChain.name;
    } else {
        currentChainElement.dataset.edit = 'true';
        currentChainElement.innerText = '';
        const textField = document.createElement('input');
        textField.classList.add('form-control', 'input-sm');
        textField.value = currentChain.name;
        textField.onkeydown = async event => {
            if(event.key == 'Enter') {
                currentChainElement.dataset.edit = 'false';
                const oldName = currentChain.name;
                if(oldName == textField.value) {
                    currentChainElement.innerText = oldName;
                    return;
                }
                try {
                    await renameCurrentChain(textField.value);
                    showToast({
                        message: `Chain <b>${oldName}</b> renamed to <b>${textField.value}</b>`,
                        type: 'info'
                    });
                } catch(err) {
                    currentChainElement.innerText = oldName;
                    showError(err.message);
                }
            }
        };
        currentChainElement.appendChild(textField);
        setTimeout(() => textField.focus(), 50);
    }
});
async function renameCurrentChain(newName) {
    if(!newName || newName == currentChain.name) return;

    let res = await fetch(`/api/chain?table=${encodeParam(currentChain.table)}&ip6=${currentChain.ip6}&action=rename&name=${encodeParam(currentChain.name)}&newName=${encodeParam(newName)}`, { method: 'POST'});
    if(res.status == 500) throw new Error(await res.text());
    if(!res.ok) throw new Error('Request failed with status: '+res.status);

    await loadChains();
    await switchChain(currentChain.ip6+'-'+currentChain.table+'-'+newName);
}

document.querySelector('#currentChainActions .transparentDeleteBtn').addEventListener('click', async event => {
    const clickHandler = async () => {
        try {
            await deleteCurrentChain();
            showToast({
                message: `Chain <b>${currentChain.name}</b> successfully deleted`,
                type: 'danger'
            });
        } catch(err) {
            showError(err.message);
        }
    };
    if(event.shiftKey) {
        clickHandler();
    } else {
        const modalOpts = {
            type: 'danger',
            title: 'Delete chain',
            body: `Are you sure that you want to delete the chain <b>${currentChain.name}</b>?`,
            acceptText: 'Delete'
        };
        if((await showModal(modalOpts)).accept) clickHandler();
    }
});
async function deleteCurrentChain() {
    let res = await fetch(`/api/chain?table=${encodeParam(currentChain.table)}&ip6=${currentChain.ip6}&name=${encodeParam(currentChain.name)}`, { method: 'DELETE' });
    if(res.status == 500) throw new Error(await res.text());
    if(!res.ok) throw new Error('Request failed with status: '+res.status);

    await loadChains();
    await switchChain(defaultChain);
}

async function showCreateChainModal(table, ip6) {
    const modalOpts = {
        type: 'success',
        title: 'Create new chain',
        body: `<label for="createChainName">Name</label><input class="form-control" id="createChainName" name="chainName">`,
        acceptText: 'Create',
        onInit: event => {
            const nameField = event.modalElement.querySelector('.modal-body input')
            nameField.onkeydown = event1 => {
                if(event1.key == 'Enter') event.acceptBtn.click();
            };
            setTimeout(() => nameField.focus(), 50);
        }
    };
    const modal = await showModal(modalOpts);
    if(modal.accept) {
        if(!modal.inputs.chainName) return;
        try {
            await createNewChain(table, ip6, modal.inputs.chainName);
            showToast({
                message: `Chain <b>${modal.inputs.chainName}</b> successfully created`,
                type: 'success'
            });
        } catch(err) {
            showError(err.message);
        }
    }
}
async function createNewChain(table, ip6, name) {
    let res = await fetch(`/api/chain?table=${encodeParam(table)}&ip6=${ip6}&name=${encodeParam(name)}`, { method: 'PUT' });
    if(res.status == 500) throw new Error(await res.text());
    if(!res.ok) throw new Error('Request failed with status: '+res.status);

    await loadChains();
    await switchChain(ip6+'-'+table+'-'+name);
}

document.querySelector('#currentChainDefaultPolicy select').addEventListener('change', async event => {
    if(!currentChain.system) return;
    try {
        await setDefaultPolicy(event.target.value);
        currentChain.defaultPolicy = event.target.value;
        event.target.setAttribute('style', `color: rgb(var(--bs-${currentChain.defaultPolicy == 'ACCEPT' ? 'success' : 'danger'}-rgb)) !important`);
    } catch(err) {
        event.target.value = currentChain.defaultPolicy;
        showError(err.message);
    }
});
async function setDefaultPolicy(policy) {
    let res = await fetch(`/api/chain?table=${encodeParam(currentChain.table)}&ip6=${currentChain.ip6}&action=setDefaultPolicy&name=${encodeParam(currentChain.name)}&policy=${encodeParam(policy)}`, { method: 'POST'});
    if(res.status == 500) throw new Error(await res.text());
    if(!res.ok) throw new Error('Request failed with status: '+res.status);
}
saveChainToggle.addEventListener('change', async event => {
    try {
        await setChainDynamic(!event.target.checked);
        currentChain.dynamic = !event.target.checked;
    } catch(err) {
        event.target.value = currentChain.defaultPolicy;
        showError(err.message);
    }
});
async function setChainDynamic(dynamic) {
    let res = await fetch(`/api/chain?table=${encodeParam(currentChain.table)}&ip6=${currentChain.ip6}&action=setDynamic&name=${encodeParam(currentChain.name)}&dynamic=${dynamic}`, { method: 'POST'});
    if(res.status == 500) throw new Error(await res.text());
    if(!res.ok) throw new Error('Request failed with status: '+res.status);
}

// Rules
async function loadRules(forceUpdate = true) {
    let res = await fetch(`/api/rules?chain=${encodeParam(currentChain.name)}&table=${encodeParam(currentChain.table)}&ip6=${currentChain.ip6}`);
    if(res.status == 500) throw new Error(await res.text());
    if(!res.ok) throw new Error('Request failed with status: '+res.status);
    res = await res.json();

    // Try detecting changes by other applications by quickly comparing chain length
    if(forceUpdate || numRules != res.length) {
        if(!forceUpdate) {
            showToast({
                message: 'Iptables rules were changed by other application',
                type: 'danger'
            })
        }
        let i = 1;
        rulesTable.innerHTML = '';
        numRules = res.length;
        if(res.length == 0) {
            const tableRow = document.createElement('tr');
            const td1 = document.createElement('td');
            const td2 = document.createElement('td');
            const td3 = document.createElement('td');
            td3.className = 'text-light';
            td3.textContent = 'Empty chain';
            const td4 = document.createElement('td');
            tableRow.appendChild(td1);
            tableRow.appendChild(td2);
            tableRow.appendChild(td3);
            tableRow.appendChild(td4);
            rulesTable.appendChild(tableRow);
        } else {
            res.forEach(rule => {
                const tableRow = document.createElement('tr');
                tableRow.id = `rule-${i}`;
                tableRow.dataset.rule = rule;
                tableRow.dataset.index = i;
                
                const handleCell = document.createElement('td');
                handleCell.className = 'handle';
                tableRow.appendChild(handleCell);
                
                const indexCell = document.createElement('td');
                indexCell.textContent = i;
                tableRow.appendChild(indexCell);
                
                const ruleCell = document.createElement('td');
                ruleCell.className = 'rule';
                ruleCell.innerHTML = highlightRuleSyntax(rule);
                tableRow.appendChild(ruleCell);
                
                const actionCell = document.createElement('td');
                const editBtn = document.createElement('button');
                editBtn.className = 'btn-transparent transparentEditBtn';
                editBtn.title = 'Edit';
                editBtn.textContent = '\u00a0';
                editBtn.addEventListener('click', () => showEditRuleField(tableRow, i));
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn-transparent transparentDeleteBtn';
                deleteBtn.title = 'Delete';
                deleteBtn.textContent = '\u00a0';
                deleteBtn.addEventListener('click', (event) => showDeleteRuleModal(tableRow, event.shiftKey, i));
                
                actionCell.appendChild(editBtn);
                actionCell.appendChild(deleteBtn);
                tableRow.appendChild(actionCell);
                
                rulesTable.appendChild(tableRow);
                i++;
            });
        }
        addRuleForm.querySelector('.index').placeholder = i;
        $('#rulesTable').tableDnDUpdate();
    }
}

async function moveRow(oldIndex, newIndex) {
    if(oldIndex == newIndex) return;
    let res = await fetch(`/api/rules?table=${encodeParam(currentChain.table)}&ip6=${currentChain.ip6}&chain=${encodeParam(currentChain.name)}&action=move&index=${oldIndex}&newIndex=${newIndex}`, { method: 'POST' });
    if(res.status == 500) throw new Error(await res.text());
    if(!res.ok) throw new Error('Request failed with status: '+res.status);
    await loadRules();
}

async function showDeleteRuleModal(row, skipWarning, index) {
    const clickHandler = async () => {
        try {
            await deleteRule(index);
            showToast({
                message: `Rule <b>${index}</b> successfully deleted`,
                type: 'danger'
            });
        } catch(err) {
            showError(err.message);
        }
    };
    if(skipWarning) {
        clickHandler();
    } else {
        const ruleText = row.dataset.rule;
        const modalOpts = {
            type: 'danger',
            title: 'Delete rule',
            body: `<p>Are you sure that you want to delete the following rule?</p><b>${escapeHtml(ruleText)}</b>`
        };
        if((await showModal(modalOpts)).accept) clickHandler();
    }
}
async function deleteRule(index) {
    let res = await fetch(`/api/rules?table=${encodeParam(currentChain.table)}&ip6=${currentChain.ip6}&chain=${encodeParam(currentChain.name)}&index=${index}`, { method: 'DELETE' });
    if(res.status == 500) throw new Error(await res.text());
    if(!res.ok) throw new Error('Request failed with status: '+res.status);
    await loadRules();
}

function showEditRuleField(row, index) {
    const ruleColumn = row.querySelector('.rule');
    if(row.dataset.edit == 'true') {
        row.dataset.edit = 'false';
        ruleColumn.innerHTML = highlightRuleSyntax(row.dataset.rule);
    } else {
        row.dataset.edit = 'true';
        const textField = document.createElement('input');
        textField.classList.add('form-control', 'input-sm');
        textField.value = ruleColumn.innerText;
        const originalRule = row.dataset.rule;
        textField.onkeydown = async event => {
            if(event.key == 'Enter') {
                row.dataset.edit = 'false';
                if(!textField.value || textField.value == originalRule) {
                    ruleColumn.innerHTML = highlightRuleSyntax(originalRule);
                    return;
                }
                try {
                    await editRule(index, textField.value);
                } catch(err) {
                    ruleColumn.innerHTML = highlightRuleSyntax(originalRule);
                    showError(err.message);
                }
            }
        };
        ruleColumn.innerText = '';
        ruleColumn.appendChild(textField);
        setTimeout(() => textField.focus(), 50);
    }
}
async function editRule(index, newValue) {
    let res = await fetch(`/api/rules?table=${encodeParam(currentChain.table)}&ip6=${currentChain.ip6}&chain=${encodeParam(currentChain.name)}&action=edit&index=${index}`, {
        method: 'POST',
        headers: new Headers({'Content-Type': 'application/json'}),
        body: JSON.stringify({rule: newValue})
    });
    if(res.status == 500) throw new Error(await res.text());
    if(!res.ok) throw new Error('Request failed with status: '+res.status);
    await loadRules();
}

addRuleForm.querySelectorAll('input').forEach(input => {
    input.addEventListener('keydown', event => {
        if(event.key == 'Enter') addRuleForm.querySelector('.transparentCreateBtn').click();
    });
});
addRuleForm.querySelector('.transparentCreateBtn').addEventListener('click', async () => {
    const indexField = addRuleForm.querySelector('.index');
    const ruleField = addRuleForm.querySelector('.value');
    if(!ruleField.value) return;
    let index = parseInt(indexField.value), lastIndex = parseInt(indexField.placeholder);
    if(!index || index < 1 || index > lastIndex) index = lastIndex;

    try {
        await insertRule(index, ruleField.value);
        showToast({
            message: `Rule <b>${index}</b> successfully created`,
            type: 'success'
        });
    } catch(err) {
        showError(err.message);
    }
    indexField.value = '';
    ruleField.value = '';
});
async function insertRule(index, value) {
    if(!value) return;

    let res = await fetch(`/api/rules?table=${encodeParam(currentChain.table)}&ip6=${currentChain.ip6}&chain=${encodeParam(currentChain.name)}&index=${index}`, {
        method: 'PUT',
        headers: new Headers({'Content-Type': 'application/json'}),
        body: JSON.stringify({rule: value})
    });
    if(res.status == 500) throw new Error(await res.text());
    if(!res.ok) throw new Error('Request failed with status: '+res.status);
    await loadRules();
}

// Load & save
saveRulesBtn.addEventListener('click', async () => {
    const modalOpts = {
        type: 'success',
        title: 'Save rules',
        body: 'Are you sure that you want to save the current rules?',
        acceptText: 'Save'
    };
    if((await showModal(modalOpts)).accept) {
        try {
            let res = await fetch(`/api/save`, { method: 'POST' });
            if(res.status == 500) throw new Error(await res.text());
            if(!res.ok) throw new Error('Request failed with status: '+res.status);
            showToast({
                message: `Configuration saved`,
                type: 'info'
            });
        } catch(err) {
            showError(err.message);
        }
    }
});
loadRulesBtn.addEventListener('click', async () => {
    const modalOpts = {
        type: 'success',
        title: 'Load rules',
        body: 'Are you sure that you want to load the previous configuration? Current rules will be overwritten.',
        acceptText: 'Save'
    };
    if((await showModal(modalOpts)).accept) {
        try {
            let res = await fetch(`/api/restore`, { method: 'POST' });
            if(res.status == 500) throw new Error(await res.text());
            if(!res.ok) throw new Error('Request failed with status: '+res.status);
            await loadRules();
            showToast({
                message: `Configuration loaded`,
                type: 'info'
            });
        } catch(err) {
            showError(err.message);
        }
    }
});

// Common
document.addEventListener('DOMContentLoaded', async () => {
    $('#rulesTable').tableDnD({
        onDrop: async (table, draggedRow) => {
            let newIndex, oldIndex = draggedRow.id.replace('rule-', '');
            let i = 1;
            for(const row of rulesTable.children) {
                if(row == draggedRow) newIndex = i;
                i++;
            }
            try {
                await moveRow(oldIndex, newIndex)
            } catch(err) {
                showError(err.message);
            }
        },
        dragHandle: '.handle',
        onDragClass: 'isDragged'
    });

    try {
        await loadChains();
    } catch(err) {
        showError(err.message);
    }
    setInterval(() => {
        try {
            loadRules(false)
        } catch(err) {
            showError(err.message);
        }
    }, 60000);
});

function highlightRuleSyntax(rule) {
    // Link to related chains
    const matches = rule.match(/\-j (.+?)$/);
    if(matches) {
        const chainId = currentChain.ip6+'-'+currentChain.table+'-'+matches[1];
        if(chains[chainId]) {
            rule = rule.replace(/\-j (.+?)$/, `-j <span class="hl-link" onclick="switchChain('${chainId}');">$1</span>`);
        }
    }

    // Colorize common rule elements
    return rule.replace(/!/g, '<span class="hl-color-not">!</span>')
               .replace(/(\-i|\-o) .+?(\s|$)/g, '<span class="hl-color-if">$&</span>')
               .replace(/(\-s|\-d) .+?(\s|$)/g, '<span class="hl-color-ip">$&</span>')
               .replace(/(\-p|\-m) (tcp|udp)/g, '<span class="hl-color-tcp">$&</span>')
               .replace(/--(d|s)port .+?(\s|$)/g, '<span class="hl-color-tcp">$&</span>')
               .replace('-j ACCEPT', '-j <span class="text-success">ACCEPT</span>')
               .replace(/-j (DROP|REJECT)/, '-j <span class="text-danger">$1</span>')
               .replace(/--reject-with .+?(\s|$)/, '<span class="text-danger">$&</span>');
}

if(document.cookie.includes('token=')) logoutBtn.classList.remove('d-none');
logoutBtn.addEventListener('click', async () => {
    let res = await fetch('/api/logout', { method: 'POST' });
    if(!res.ok) throw new Error('Request failed with status: '+res.status);
    window.location.replace('/login.html');
});
