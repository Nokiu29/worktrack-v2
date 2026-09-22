let me = null;
let workTypes = [];
let reportItemId = 0;
let registerMode = false;

const $ = id =>
    document.getElementById(id);


/* ============================================================
   API
============================================================ */

async function api(
    url,
    opt = {}
) {

    const response =
        await fetch(
            url,
            {
                ...opt,

                credentials:
                    'same-origin',

                headers: {
                    'Content-Type':
                        'application/json',

                    ...(opt.headers || {})
                }
            }
        );


    const data =
        await response
            .json()
            .catch(
                () => ({})
            );


    if (
        !response.ok
    ) {

        throw new Error(
            data.error ||
            'Помилка'
        );

    }


    return data;

}


/* ============================================================
   HTML ESCAPE
============================================================ */

function escapeHtml(
    value
) {

    return String(
        value ?? ''
    )
        .replace(
            /&/g,
            '&amp;'
        )
        .replace(
            /</g,
            '&lt;'
        )
        .replace(
            />/g,
            '&gt;'
        )
        .replace(
            /"/g,
            '&quot;'
        )
        .replace(
            /'/g,
            '&#039;'
        );

}


/* ============================================================
   MONEY
============================================================ */

function money(
    value
) {

    return (
        Number(
            value || 0
        ).toFixed(2) +
        ' ₴'
    );

}


/* ============================================================
   ROLE
============================================================ */

function roleText(
    role
) {

    if (
        role ===
        'superadmin'
    ) {

        return 'Головний адміністратор';

    }


    if (
        role ===
        'admin'
    ) {

        return 'Адміністратор';

    }


    return 'Працівник';

}


/* ============================================================
   TODAY
============================================================ */

function today() {

    const date =
        new Date();


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            '0'
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            '0'
        );


    return `${year}-${month}-${day}`;

}


/* ============================================================
   BOOT
============================================================ */

async function boot() {

    try {

        const data =
            await api(
                '/api/me'
            );


        if (
            data.user
        ) {

            me =
                data.user;


            await openApp();

        } else {

            if (
                $('auth')
            ) {

                $('auth')
                    .classList
                    .remove(
                        'hidden'
                    );

            }

        }

    } catch (error) {

        console.error(
            'BOOT ERROR:',
            error
        );


        if (
            $('auth')
        ) {

            $('auth')
                .classList
                .remove(
                    'hidden'
                );

        }

    }

}


/* ============================================================
   OPEN APP
============================================================ */

async function openApp() {

    if (
        !$('auth') ||
        !$('app')
    ) {

        return;

    }


    $('auth')
        .classList
        .add(
            'hidden'
        );


    $('app')
        .classList
        .remove(
            'hidden'
        );


    document.body.classList
        .remove(
            'auth-mode'
        );


    let roleValue =
        '';


    if (
        me.role ===
        'superadmin'
    ) {

        roleValue =
            ' · Головний адміністратор';

    } else if (
        me.role ===
        'admin'
    ) {

        roleValue =
            ' · Адміністратор';

    }


    if (
        $('who')
    ) {

        $('who').textContent =
            me.name +
            roleValue;

    }


    const isAdmin =
        me.role === 'admin' ||
        me.role === 'superadmin';


    document
        .querySelectorAll(
            '.adminOnly'
        )
        .forEach(
            element => {

                element.style.display =
                    isAdmin
                        ? ''
                        : 'none';

            }
        );


    document
        .querySelectorAll(
            '.superAdminOnly'
        )
        .forEach(
            element => {

                element.style.display =
                    me.role ===
                    'superadmin'
                        ? ''
                        : 'none';

            }
        );


    if (
        $('rdate')
    ) {

        $('rdate').value =
            today();

    }


    await loadWorkTypes();


    if (
        $('reportItems') &&
        $('reportItems').children.length ===
        0
    ) {

        addReportItem();

    }


    await show(
        'dashboard'
    );

}


/* ============================================================
   NAVIGATION
============================================================ */

document
    .querySelectorAll(
        '.nav[data-page]'
    )
    .forEach(
        button => {

            button.addEventListener(
                'click',
                () => {

                    show(
                        button.dataset.page
                    );

                }
            );

        }
    );


async function show(
    id
) {

    document
        .querySelectorAll(
            '.page'
        )
        .forEach(
            page => {

                page.classList
                    .add(
                        'hidden'
                    );

            }
        );


    const page =
        $(id);


    if (
        !page
    ) {

        return;

    }


    page.classList
        .remove(
            'hidden'
        );


    document
        .querySelectorAll(
            '.nav[data-page]'
        )
        .forEach(
            button => {

                button.classList.toggle(
                    'active',
                    button.dataset.page ===
                    id
                );

            }
        );


    if (
        id ===
        'dashboard'
    ) {

        await loadDashboard();

    }


    if (
        id ===
        'reports'
    ) {

        await loadMyReports();

        updateReportTotal();

    }


    if (
        id ===
        'employees'
    ) {

        await loadAdmin();

    }


    if (
        id ===
        'allReports'
    ) {

        await loadAllReports();

    }


    if (
        id ===
        'workTypes'
    ) {

        await loadWorkTable();

    }


    if (
        id ===
        'management'
    ) {

        await loadManagement();

    }


    window.scrollTo(
        0,
        0
    );

}


/* ============================================================
   LOGIN / REGISTER
============================================================ */

const toggleAuth =
    document.getElementById(
        'toggleAuth'
    );


const authTitle =
    document.getElementById(
        'authTitle'
    );


const authSub =
    document.getElementById(
        'authSub'
    );


const authBtn =
    document.getElementById(
        'authBtn'
    );


const nameWrap =
    document.getElementById(
        'nameWrap'
    );


const nameInput =
    document.getElementById(
        'name'
    );


if (
    toggleAuth &&
    authTitle &&
    authSub &&
    authBtn &&
    nameWrap &&
    nameInput
) {

    toggleAuth.addEventListener(
        'click',
        () => {

            registerMode =
                !registerMode;


            if (
                registerMode
            ) {

                nameWrap
                    .classList
                    .remove(
                        'hidden'
                    );


                nameInput.required =
                    true;


                authTitle.textContent =
                    'Реєстрація';


                authSub.textContent =
                    'Створіть обліковий запис працівника';


                authBtn.textContent =
                    'Зареєструватися';


                toggleAuth.textContent =
                    'Вже є акаунт? Увійти';

            } else {

                nameWrap
                    .classList
                    .add(
                        'hidden'
                    );


                nameInput.required =
                    false;


                nameInput.value =
                    '';


                authTitle.textContent =
                    'Вхід у систему';


                authSub.textContent =
                    'Робочий кабінет та облік виробітку';


                authBtn.textContent =
                    'Увійти';


                toggleAuth.textContent =
                    'Немає акаунта? Зареєструватися';

            }

        }
    );

}


/* ============================================================
   AUTH FORM
============================================================ */

if (
    $('authForm')
) {

    $('authForm').addEventListener(
        'submit',
        async event => {

            event.preventDefault();


            try {

                const data =
                    await api(
                        registerMode
                            ? '/api/register'
                            : '/api/login',
                        {

                            method:
                                'POST',

                            body:
                                JSON.stringify({

                                    name:
                                        $('name')
                                            ? $('name')
                                                .value
                                                .trim()
                                            : '',

                                    login:
                                        $('login')
                                            .value
                                            .trim(),

                                    password:
                                        $('password')
                                            .value

                                })

                        }
                    );


                me =
                    data.user;


                await openApp();


            } catch (error) {

                alert(
                    error.message
                );

            }

        }
    );

}


/* ============================================================
   LOGOUT
============================================================ */

async function logout() {

    try {

        await api(
            '/api/logout',
            {
                method:
                    'POST'
            }
        );

    } catch (_) {
    }


    location.reload();

}


/* ============================================================
   WORK TYPES
============================================================ */

async function loadWorkTypes() {

    try {

        const data =
            await api(
                '/api/work-types'
            );


        workTypes =
            Array.isArray(
                data
            )
                ? data
                : (
                    Array.isArray(
                        data.workTypes
                    )
                        ? data.workTypes
                        : []
                );


        fillReportWorkTypes();


    } catch (error) {

        console.error(
            'WORK TYPES ERROR:',
            error
        );


        workTypes =
            [];

    }

}


/* ============================================================
   FILL REPORT WORK TYPES
============================================================ */

function fillReportWorkTypes() {

    document
        .querySelectorAll(
            '.report-work-type'
        )
        .forEach(
            select => {

                const oldValue =
                    select.value;


                select.innerHTML =
                    '';


                if (
                    !workTypes.length
                ) {

                    select.innerHTML = `
                        <option value="">
                            Завдань поки немає
                        </option>
                    `;


                    select.disabled =
                        true;


                    return;

                }


                select.disabled =
                    false;


                select.innerHTML = `

                    <option value="">
                        Оберіть завдання
                    </option>

                    ${
                        workTypes
                            .map(
                                work => `

                                    <option
                                        value="${work.id}"
                                    >

                                        ${escapeHtml(
                                            work.name
                                        )}

                                    </option>

                                `
                            )
                            .join('')
                    }

                `;


                if (
                    oldValue &&
                    workTypes.some(
                        work =>
                            String(
                                work.id
                            ) ===
                            String(
                                oldValue
                            )
                    )
                ) {

                    select.value =
                        oldValue;

                }


                updateReportItem(
                    select.closest(
                        '.report-item'
                    )
                );

            }
        );

}


/* ============================================================
   CREATE REPORT ITEM
============================================================ */

function createReportItem() {

    reportItemId++;


    return `

        <div
            class="report-item"
            data-report-id="${reportItemId}"
        >

            <div class="report-item-header">

                <b class="report-item-title">
                    Завдання ${reportItemId}
                </b>

                <button
                    type="button"
                    class="danger-button remove-report-item"
                >
                    Видалити
                </button>

            </div>


            <div class="report-fields">

                <label>

                    Вид роботи

                    <select
                        class="report-work-type"
                        required
                    >

                        ${
                            workTypes.length

                                ? `

                                    <option value="">
                                        Оберіть завдання
                                    </option>

                                    ${
                                        workTypes
                                            .map(
                                                work => `

                                                    <option
                                                        value="${work.id}"
                                                    >

                                                        ${escapeHtml(
                                                            work.name
                                                        )}

                                                    </option>

                                                `
                                            )
                                            .join('')
                                    }

                                `

                                : `

                                    <option value="">
                                        Завдань поки немає
                                    </option>

                                `
                        }

                    </select>

                </label>


                <label>

                    Години

                    <input
                        type="number"
                        class="report-hours"
                        min="0.5"
                        step="0.5"
                        required
                    >

                </label>


                <label>

                    Кількість

                    <input
                        type="number"
                        class="report-quantity"
                        min="0"
                        step="1"
                        required
                    >

                </label>

            </div>


            <div class="report-preview">

                <span>

                    Виробіток

                    <b class="item-productivity">
                        —
                    </b>

                </span>


                <span>

                    Норма

                    <b class="item-norm">
                        —
                    </b>

                </span>


                <span>

                    Виконання

                    <b class="item-percent">
                        —
                    </b>

                </span>

            </div>

        </div>

    `;

}


/* ============================================================
   ADD REPORT ITEM
============================================================ */

function addReportItem() {

    const container =
        $('reportItems');


    if (
        !container
    ) {

        return;

    }


    container.insertAdjacentHTML(
        'beforeend',
        createReportItem()
    );


    const item =
        container.lastElementChild;


    const select =
        item.querySelector(
            '.report-work-type'
        );


    const hours =
        item.querySelector(
            '.report-hours'
        );


    const quantity =
        item.querySelector(
            '.report-quantity'
        );


    const remove =
        item.querySelector(
            '.remove-report-item'
        );


    select.addEventListener(
        'change',
        () =>
            updateReportItem(
                item
            )
    );


    hours.addEventListener(
        'input',
        () =>
            updateReportItem(
                item
            )
    );


    quantity.addEventListener(
        'input',
        () =>
            updateReportItem(
                item
            )
    );


    remove.addEventListener(
        'click',
        () => {

            const allItems =
                document.querySelectorAll(
                    '.report-item'
                );


            if (
                allItems.length <= 1
            ) {

                select.value =
                    '';

                hours.value =
                    '';

                quantity.value =
                    '';

                updateReportItem(
                    item
                );

                return;

            }


            item.remove();


            refreshReportNumbers();


            updateReportTotal();

        }
    );


    updateReportItem(
        item
    );


    updateReportTotal();

}


/* ============================================================
   REPORT NUMBERS
============================================================ */

function refreshReportNumbers() {

    document
        .querySelectorAll(
            '.report-item'
        )
        .forEach(
            (
                item,
                index
            ) => {

                const title =
                    item.querySelector(
                        '.report-item-title'
                    );


                if (
                    title
                ) {

                    title.textContent =
                        `Завдання ${index + 1}`;

                }

            }
        );

}


/* ============================================================
   UPDATE REPORT ITEM
============================================================ */

function updateReportItem(
    item
) {

    if (
        !item
    ) {

        return;

    }


    const select =
        item.querySelector(
            '.report-work-type'
        );


    const hoursInput =
        item.querySelector(
            '.report-hours'
        );


    const quantityInput =
        item.querySelector(
            '.report-quantity'
        );


    const prod =
        item.querySelector(
            '.item-productivity'
        );


    const norm =
        item.querySelector(
            '.item-norm'
        );


    const percent =
        item.querySelector(
            '.item-percent'
        );


    if (
        !select ||
        !hoursInput ||
        !quantityInput ||
        !prod ||
        !norm ||
        !percent
    ) {

        return;

    }


    const work =
        workTypes.find(
            work =>
                String(
                    work.id
                ) ===
                String(
                    select.value
                )
        );


    if (
        !work
    ) {

        prod.textContent =
            '—';

        norm.textContent =
            '—';

        percent.textContent =
            '—';

        return;

    }


    const hours =
        Number(
            hoursInput.value
        );


    const quantity =
        Number(
            quantityInput.value
        );


    norm.textContent =
        Number(
            work.norm || 0
        ).toFixed(
            0
        ) +
        '/год';


    if (
        hours > 0 &&
        quantity >= 0
    ) {

        const productivity =
            quantity /
            hours;


        const percentage =
            Number(
                work.norm
            ) > 0
                ? productivity /
                  Number(
                      work.norm
                  ) *
                  100
                : 0;


        prod.textContent =
            productivity.toFixed(
                1
            ) +
            '/год';


        percent.textContent =
            percentage.toFixed(
                0
            ) +
            '%';


        percent.classList.remove(
            'ok',
            'low'
        );


        if (
            percentage >= 100
        ) {

            percent.classList.add(
                'ok'
            );

        } else if (
            percentage < 85
        ) {

            percent.classList.add(
                'low'
            );

        }

    } else {

        prod.textContent =
            '—';

        percent.textContent =
            '—';

    }

}


/* ============================================================
   REPORT TOTAL
============================================================ */

function updateReportTotal() {

    const count =
        document.querySelectorAll(
            '.report-item'
        ).length;


    if (
        $('reportTotal')
    ) {

        $('reportTotal').innerHTML =
            `Завдань: <b>${count}</b>`;

    }

}


/* ============================================================
   RESET REPORT
============================================================ */

function resetReportForm() {

    reportItemId =
        0;


    if (
        $('reportItems')
    ) {

        $('reportItems').innerHTML =
            '';

    }


    if (
        $('rdate')
    ) {

        $('rdate').value =
            today();

    }


    addReportItem();

}


/* ============================================================
   SAVE REPORT
============================================================ */

if (
    $('reportForm')
) {

    $('reportForm').addEventListener(
        'submit',
        async event => {

            event.preventDefault();


            if (
                !workTypes.length
            ) {

                alert(
                    'Спочатку адміністратор повинен додати завдання'
                );

                return;

            }


            const items =
                [];


            const reportItems =
                document.querySelectorAll(
                    '.report-item'
                );


            for (
                let i = 0;
                i < reportItems.length;
                i++
            ) {

                const item =
                    reportItems[i];


                const workType =
                    item.querySelector(
                        '.report-work-type'
                    );


                const hours =
                    item.querySelector(
                        '.report-hours'
                    );


                const quantity =
                    item.querySelector(
                        '.report-quantity'
                    );


                if (
                    !workType.value ||
                    Number(
                        hours.value
                    ) <= 0 ||
                    Number(
                        quantity.value
                    ) < 0
                ) {

                    alert(
                        `Перевірте дані завдання №${i + 1}`
                    );

                    return;

                }


                items.push({

                    work_type_id:
                        Number(
                            workType.value
                        ),

                    hours:
                        Number(
                            hours.value
                        ),

                    quantity:
                        Number(
                            quantity.value
                        )

                });

            }


            try {

                const result =
                    await api(
                        '/api/reports',
                        {

                            method:
                                'POST',

                            body:
                                JSON.stringify({

                                    work_date:
                                        $('rdate')
                                            .value,

                                    items

                                })

                        }
                    );


                const taskCount =
                    result.task_count ??
                    result.taskCount ??
                    items.length;


                const totalEarnings =
                    result.total_earnings ??
                    result.totalEarnings ??
                    0;


                alert(
                    `Звіт збережено.\n` +
                    `Завдань у звіті: ${taskCount}\n` +
                    `Загальний заробіток: ${money(
                        totalEarnings
                    )}`
                );


                resetReportForm();


                await loadMyReports();


                await loadDashboard();


            } catch (error) {

                alert(
                    error.message
                );

            }

        }
    );

}


/* ============================================================
   TABLE
============================================================ */

function basicTable(
    headers,
    rows
) {

    return `

        <div class="table-scroll">

            <table>

                <thead>

                    <tr>

                        ${
                            headers
                                .map(
                                    header =>
                                        `<th>${header}</th>`
                                )
                                .join('')
                        }

                    </tr>

                </thead>


                <tbody>

                    ${
                        rows &&
                        rows.length

                            ? rows.join('')

                            : `

                                <tr>

                                    <td
                                        colspan="${headers.length}"
                                        class="empty-cell"
                                    >

                                        Записів поки немає

                                    </td>

                                </tr>

                              `
                    }

                </tbody>

            </table>

        </div>

    `;

}


/* ============================================================
   MY REPORTS
   БЕЗ "КІЛЬКІСТЬ"
============================================================ */

async function loadMyReports() {

    try {

        const data =
            await api(
                '/api/my/reports'
            );


        const rows =
            Array.isArray(
                data
            )
                ? data
                : (
                    Array.isArray(
                        data.reports
                    )
                        ? data.reports
                        : []
                );


        if (
            !$('myTable')
        ) {

            return;

        }


        if (
            !rows.length
        ) {

            $('myTable').innerHTML = `

                <div class="empty-reports">

                    Звітів поки немає

                </div>

            `;

            return;

        }


        const tableRows =
            rows.map(
                row => {

                    const productivity =
                        Number(
                            row.productivity ||
                            0
                        );


                    const norm =
                        Number(
                            row.norm ||
                            0
                        );


                    const percent =
                        norm > 0
                            ? productivity /
                              norm *
                              100
                            : 0;


                    return `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    row.work_date
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    row.work_name
                                )}
                            </td>

                            <td>
                                ${Number(
                                    row.hours ||
                                    0
                                ).toFixed(2)}
                            </td>

                            <td>
                                ${productivity.toFixed(1)}/год
                            </td>

                            <td class="${
                                percent >= 100
                                    ? 'ok'
                                    : percent < 85
                                        ? 'low'
                                        : ''
                            }">

                                ${percent.toFixed(1)}%

                            </td>

                            <td>
                                ${money(
                                    row.earnings
                                )}
                            </td>

                        </tr>

                    `;

                }
            );


        $('myTable').innerHTML =
            basicTable(
                [
                    'Дата',
                    'Робота',
                    'Години',
                    'Виробіток',
                    'Виконання',
                    'Заробіток'
                ],
                tableRows
            );


    } catch (error) {

        console.error(
            'MY REPORTS ERROR:',
            error
        );


        if (
            $('myTable')
        ) {

            $('myTable').innerHTML = `

                <div class="error-state">

                    ${escapeHtml(
                        error.message
                    )}

                </div>

            `;

        }

    }

}


/* ============================================================
   DASHBOARD
============================================================ */

async function loadDashboard() {

    try {

        const summary =
            await api(
                '/api/my/summary'
            );


        const totalEarnings =
            Number(
                summary.total_earnings ??
                summary.earnings ??
                0
            );


        const totalHours =
            Number(
                summary.total_hours ??
                summary.hours ??
                0
            );


        const reportCount =
            Number(
                summary.report_count ??
                summary.reports ??
                0
            );


        if (
            $('earnings')
        ) {

            $('earnings').textContent =
                totalEarnings.toFixed(
                    0
                ) +
                ' ₴';

        }


        if (
            $('hours')
        ) {

            $('hours').textContent =
                totalHours.toFixed(
                    1
                ) +
                ' год';

        }


        if (
            $('reportCount')
        ) {

            $('reportCount').textContent =
                reportCount;

        }


        /*
           Удаляем старую карточку
           quantity, если она ещё есть.
        */

        if (
            $('quantity')
        ) {

            const card =
                $('quantity')
                    .closest(
                        '.stats > div'
                    );


            if (
                card
            ) {

                card.remove();

            }

        }


        /*
           ДАШБОРД АДМИНИСТРАТОРА
        */

        if (
            me.role === 'admin' ||
            me.role === 'superadmin'
        ) {

            const adminData =
                await api(
                    '/api/admin/dashboard'
                );


            const recentReports =
                adminData.recentReports ||
                [];


            if (
                $('dashTable')
            ) {

                const tableRows =
                    recentReports
                        .slice(
                            0,
                            10
                        )
                        .map(
                            row => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            row.work_date
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            row.employee_name
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            row.work_name
                                        )}
                                    </td>

                                    <td>
                                        ${Number(
                                            row.hours ||
                                            0
                                        ).toFixed(2)}
                                    </td>

                                    <td>
                                        ${money(
                                            row.earnings
                                        )}
                                    </td>

                                </tr>

                            `
                        );


                $('dashTable').innerHTML =
                    basicTable(
                        [
                            'Дата',
                            'Працівник',
                            'Робота',
                            'Години',
                            'Заробіток'
                        ],
                        tableRows
                    );

            }

        } else {

            /*
               Дашборд працівника.
            */

            const data =
                await api(
                    '/api/my/reports'
                );


            const rows =
                Array.isArray(
                    data
                )
                    ? data
                    : (
                        Array.isArray(
                            data.reports
                        )
                            ? data.reports
                            : []
                    );


            if (
                $('dashTable')
            ) {

                const tableRows =
                    rows
                        .slice(
                            0,
                            5
                        )
                        .map(
                            row => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            row.work_date
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            row.work_name
                                        )}
                                    </td>

                                    <td>
                                        ${Number(
                                            row.hours ||
                                            0
                                        ).toFixed(2)}
                                    </td>

                                    <td>
                                        ${money(
                                            row.earnings
                                        )}
                                    </td>

                                </tr>

                            `
                        );


                $('dashTable').innerHTML =
                    basicTable(
                        [
                            'Дата',
                            'Робота',
                            'Години',
                            'Заробіток'
                        ],
                        tableRows
                    );

            }

        }


    } catch (error) {

        console.error(
            'DASHBOARD ERROR:',
            error
        );


        if (
            $('dashTable')
        ) {

            $('dashTable').innerHTML = `

                <div class="error-state">

                    Помилка завантаження дашборду:<br>

                    ${escapeHtml(
                        error.message
                    )}

                </div>

            `;

        }

    }

}


/* ============================================================
   ПРАЦІВНИКИ
============================================================ */

async function loadAdmin() {

    const container =
        $('employeesTable');


    if (
        !container
    ) {

        return;

    }


    try {

        const data =
            await api(
                '/api/admin/users'
            );


        const employees =
            Array.isArray(
                data.users
            )
                ? data.users
                : [];


        if (
            !employees.length
        ) {

            container.innerHTML = `

                <div class="empty-reports">

                    Працівників поки немає

                </div>

            `;

            return;

        }


        let html = `

            <div class="table-scroll">

                <table>

                    <thead>

                        <tr>

                            <th>
                                Працівник
                            </th>

                            <th>
                                Роль
                            </th>

                            <th>
                                Здано звітів
                            </th>

                            <th>
                                Відпрацьовано
                            </th>

                            <th>
                                Заробіток
                            </th>

                            <th>
                                Статус
                            </th>

                            <th>
                                Дії
                            </th>

                        </tr>

                    </thead>

                    <tbody>

        `;


        employees.forEach(
            employee => {

                let actions =
                    '';


                /*
                   Права администратора.
                */

                if (
                    me &&
                    me.role ===
                    'superadmin' &&
                    employee.login !==
                    'admin'
                ) {

                    if (
                        employee.role ===
                        'admin'
                    ) {

                        actions += `

                            <button
                                type="button"
                                class="secondary-action"
                                onclick="window.demoteUser(${employee.id})"
                            >
                                Забрати адміна
                            </button>

                        `;

                    } else {

                        actions += `

                            <button
                                type="button"
                                class="primary small-action"
                                onclick="window.promoteUser(${employee.id})"
                            >
                                Дати права адміна
                            </button>

                        `;

                    }

                }


                /*
                   Активный работник.
                */

                if (
                    employee.login !==
                    'admin' &&
                    employee.active
                ) {

                    actions += `

                        <button
                            type="button"
                            class="danger-button"
                            onclick="deleteEmployee(${employee.id})"
                        >
                            Деактивувати
                        </button>

                    `;

                }


                /*
                   Неактивный работник.
                   Только superadmin может
                   активировать и удалить.
                */

                if (
                    employee.login !==
                    'admin' &&
                    !employee.active &&
                    me &&
                    me.role ===
                    'superadmin'
                ) {

                    actions += `

                        <button
                            type="button"
                            class="small-button primary-small"
                            onclick="activateEmployee(${employee.id})"
                        >
                            Активувати
                        </button>


                        <button
                            type="button"
                            class="small-button danger-small"
                            onclick="deleteEmployeeCompletely(
                                ${employee.id},
                                '${escapeHtml(
                                    employee.name
                                )}'
                            )"
                        >
                            Видалити акаунт
                        </button>

                    `;

                }


                if (
                    !actions
                ) {

                    actions =
                        '<span class="small-muted">—</span>';

                }


                const reports =
                    Number(
                        employee.report_count ||
                        0
                    );


                const hours =
                    Number(
                        employee.total_hours ||
                        0
                    );


                const earnings =
                    Number(
                        employee.total_earnings ||
                        0
                    );


                html += `

                    <tr>

                        <td>

                            <b>

                                ${escapeHtml(
                                    employee.name ||
                                    '—'
                                )}

                            </b>

                            <br>

                            <small>

                                ${escapeHtml(
                                    employee.login ||
                                    ''
                                )}

                            </small>

                        </td>


                        <td>

                            ${escapeHtml(
                                roleText(
                                    employee.role
                                )
                            )}

                        </td>


                        <td>

                            <b>

                                ${reports}

                            </b>

                        </td>


                        <td>

                            ${hours.toFixed(
                                2
                            )}

                            год

                        </td>


                        <td>

                            <b>

                                ${money(
                                    earnings
                                )}

                            </b>

                        </td>


                        <td>

                            ${
                                employee.active

                                    ? `

                                        <span class="status-active">
                                            Активний
                                        </span>

                                      `

                                    : `

                                        <span class="status-inactive">
                                            Неактивний
                                        </span>

                                      `
                            }

                        </td>


                        <td>

                            <div class="action-buttons">

                                ${actions}

                            </div>

                        </td>

                    </tr>

                `;

            }
        );


        html += `

                    </tbody>

                </table>

            </div>

        `;


        container.innerHTML =
            html;


    } catch (error) {

        console.error(
            'PRAIVTSIVNYKY ERROR:',
            error
        );


        container.innerHTML = `

            <div class="error-state">

                Помилка завантаження працівників:<br>

                ${escapeHtml(
                    error.message
                )}

            </div>

        `;

    }

}



/* ============================================================
   ROLE MANAGEMENT
   ДАТИ АДМІНА / ЗАБРАТИ АДМІНА
============================================================ */

window.promoteUser = async function (
    userId
) {

    if (
        !me ||
        me.role !== 'superadmin'
    ) {

        alert(
            'Тільки головний адміністратор може змінювати права адміністраторів.'
        );

        return;
    }

    const id =
        Number(userId);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {

        alert(
            'Некоректний ID користувача.'
        );

        return;
    }

    try {

        const result =
            await api(
                `/api/superadmin/users/${id}/promote`,
                {
                    method: 'POST'
                }
            );

        alert(
            result.message ||
            'Права адміністратора надано.'
        );

        await loadAdmin();

        await loadManagement();

        await loadDashboard();

    } catch (error) {

        console.error(
            'PROMOTE USER ERROR:',
            error
        );

        alert(
            error.message ||
            'Не вдалося надати права адміністратора.'
        );
    }
};


window.demoteUser = async function (
    userId
) {

    if (
        !me ||
        me.role !== 'superadmin'
    ) {

        alert(
            'Тільки головний адміністратор може забирати права адміністратора.'
        );

        return;
    }

    const id =
        Number(userId);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {

        alert(
            'Некоректний ID користувача.'
        );

        return;
    }

    if (
        !confirm(
            'Забрати у цього користувача права адміністратора?'
        )
    ) {

        return;
    }

    try {

        const result =
            await api(
                `/api/superadmin/users/${id}/demote`,
                {
                    method: 'POST'
                }
            );

        alert(
            result.message ||
            'Права адміністратора знято.'
        );

        await loadAdmin();

        await loadManagement();

        await loadDashboard();

    } catch (error) {

        console.error(
            'DEMOTE USER ERROR:',
            error
        );

        alert(
            error.message ||
            'Не вдалося забрати права адміністратора.'
        );
    }
};


/* ============================================================
   DEACTIVATE EMPLOYEE
============================================================ */

async function deleteEmployee(
    userId
) {

    if (
        !confirm(
            'Деактивувати цього працівника?\n\n' +
            'Його звіти, години та заробіток залишаться в системі.\n\n' +
            'Після деактивації головний адміністратор зможе активувати акаунт назад або остаточно його видалити.'
        )
    ) {

        return;

    }


    try {

        await api(
            `/api/admin/users/${userId}`,
            {
                method:
                    'DELETE'
            }
        );


        alert(
            'Працівника деактивовано.\nРезультати та заробіток збережено.'
        );


        await loadAdmin();


        if (
            me &&
            me.role ===
            'superadmin'
        ) {

            await loadManagement();

        }


    } catch (error) {

        alert(
            error.message
        );

    }

}



window.deleteEmployee = deleteEmployee;

/* ============================================================
   ACTIVATE EMPLOYEE
============================================================ */

async function activateEmployee(
    userId
) {

    if (
        !me ||
        me.role !==
        'superadmin'
    ) {

        alert(
            'Тільки головний адміністратор може активувати акаунти.'
        );

        return;

    }


    if (
        !confirm(
            'Активувати цього працівника?\n\n' +
            'Він знову зможе увійти в систему.\n' +
            'Його звіти, години та заробіток залишаться.'
        )
    ) {

        return;

    }


    try {

        await api(
            `/api/superadmin/users/${userId}/activate`,
            {
                method:
                    'POST'
            }
        );


        alert(
            'Акаунт працівника активовано.'
        );


        await loadAdmin();


        await loadManagement();


    } catch (error) {

        alert(
            error.message
        );

    }

}



window.activateEmployee = activateEmployee;

/* ============================================================
   DELETE ACCOUNT COMPLETELY
============================================================ */

async function deleteEmployeeCompletely(
    userId,
    userName
) {

    if (
        !me ||
        me.role !==
        'superadmin'
    ) {

        alert(
            'Тільки головний адміністратор може видаляти акаунти.'
        );

        return;

    }


    const confirmed =
        confirm(

            `Остаточно видалити акаунт "${userName}"?\n\n` +

            'Перед видаленням переконайтеся, що зарплата працівнику виплачена.\n\n' +

            'Будуть видалені:\n' +

            '• акаунт працівника\n' +

            '• його звіти\n' +

            '• його історія заробітку\n\n' +

            'Цю дію неможливо скасувати.'

        );


    if (
        !confirmed
    ) {

        return;

    }


    try {

        await api(
            `/api/superadmin/users/${userId}/delete`,
            {
                method:
                    'DELETE'
            }
        );


        alert(
            'Акаунт працівника остаточно видалено.'
        );


        await loadAdmin();


        await loadManagement();


    } catch (error) {

        alert(
            error.message
        );

    }

}



window.deleteEmployeeCompletely = deleteEmployeeCompletely;

/* ============================================================
   ALL REPORTS
============================================================ */

async function loadAllReports() {

    try {

        const data =
            await api(
                '/api/admin/report-batches'
            );


        const reports =
            data.reports || [];


        const container =
            $('allReportsTable');


        if (
            !container
        ) {

            return;

        }


        if (
            !reports.length
        ) {

            container.innerHTML = `

                <div class="empty-reports">

                    Звітів поки немає

                </div>

            `;

            return;

        }


        let html = `

            <div class="reports-list">

                <div class="reports-list-header">

                    <div>
                        Дата
                    </div>

                    <div>
                        Працівник
                    </div>

                    <div>
                        Завдань
                    </div>

                    <div>
                        Години
                    </div>

                    <div>
                        Заробіток
                    </div>

                    <div></div>

                </div>

        `;


        reports.forEach(
            (
                report,
                index
            ) => {

                html += `

                    <div
                        class="report-group"
                        data-report-group="${index}"
                    >

                        <button
                            type="button"
                            class="report-group-row"
                            data-report-toggle="${index}"
                        >

                            <span class="report-date">

                                ${escapeHtml(
                                    report.work_date
                                )}

                            </span>


                            <span class="report-employee">

                                <b>

                                    ${escapeHtml(
                                        report.employee_name
                                    )}

                                </b>


                                <small>

                                    ${escapeHtml(
                                        report.login
                                    )}

                                </small>

                            </span>


                            <span class="report-task-count">

                                ${report.task_count}

                            </span>


                            <span>

                                ${Number(
                                    report.total_hours ||
                                    0
                                ).toFixed(
                                    2
                                )}

                            </span>


                            <span class="report-money">

                                ${money(
                                    report.total_earnings
                                )}

                            </span>


                            <span class="report-arrow">

                                ▼

                            </span>

                        </button>


                        <div
                            class="report-group-details"
                            id="report-details-${index}"
                        >

                            <div class="report-details-top">

                                <div>

                                    <strong>

                                        ${escapeHtml(
                                            report.employee_name
                                        )}

                                    </strong>


                                    <span>

                                        Звіт від
                                        ${escapeHtml(
                                            report.work_date
                                        )}

                                    </span>

                                </div>


                                <div class="report-details-total">

                                    ${report.task_count}

                                    ${
                                        report.task_count ===
                                        1
                                            ? 'завдання'
                                            : 'завдань'
                                    }

                                    ·

                                    ${Number(
                                        report.total_hours ||
                                        0
                                    ).toFixed(
                                        2
                                    )}

                                    год

                                    ·

                                    ${money(
                                        report.total_earnings
                                    )}

                                </div>

                            </div>


                            <div class="report-task-list">

                                <table>

                                    <thead>

                                        <tr>

                                            <th>
                                                Завдання
                                            </th>

                                            <th>
                                                Години
                                            </th>

                                            <th>
                                                Кількість
                                            </th>

                                            <th>
                                                Виробіток
                                            </th>

                                            <th>
                                                Норма
                                            </th>

                                            <th>
                                                Виконання
                                            </th>

                                            <th>
                                                Заробіток
                                            </th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        ${
                                            report.tasks
                                                .map(
                                                    task => `

                                                        <tr>

                                                            <td>

                                                                ${escapeHtml(
                                                                    task.work_name
                                                                )}

                                                            </td>


                                                            <td>

                                                                ${Number(
                                                                    task.hours ||
                                                                    0
                                                                ).toFixed(
                                                                    2
                                                                )}

                                                            </td>


                                                            <td>

                                                                ${Number(
                                                                    task.quantity ||
                                                                    0
                                                                ).toFixed(
                                                                    2
                                                                )}

                                                            </td>


                                                            <td>

                                                                ${Number(
                                                                    task.productivity ||
                                                                    0
                                                                ).toFixed(
                                                                    2
                                                                )}

                                                            </td>


                                                            <td>

                                                                ${Number(
                                                                    task.norm ||
                                                                    0
                                                                ).toFixed(
                                                                    0
                                                                )}

                                                            </td>


                                                            <td class="${
                                                                Number(
                                                                    task.percent ||
                                                                    0
                                                                ) >=
                                                                100
                                                                    ? 'ok'
                                                                    : Number(
                                                                        task.percent ||
                                                                        0
                                                                    ) < 85
                                                                        ? 'low'
                                                                        : ''
                                                            }">

                                                                ${Number(
                                                                    task.percent ||
                                                                    0
                                                                ).toFixed(
                                                                    1
                                                                )}%

                                                            </td>


                                                            <td>

                                                                ${money(
                                                                    task.earnings
                                                                )}

                                                            </td>

                                                        </tr>

                                                    `
                                                )
                                                .join('')
                                        }

                                    </tbody>

                                </table>

                            </div>

                        </div>

                    </div>

                `;

            }
        );


        html += `

            </div>

        `;


        container.innerHTML =
            html;


        container
            .querySelectorAll(
                '[data-report-toggle]'
            )
            .forEach(
                button => {

                    button.addEventListener(
                        'click',
                        () => {

                            const index =
                                button.dataset
                                    .reportToggle;


                            const group =
                                button.closest(
                                    '.report-group'
                                );


                            const details =
                                document.getElementById(
                                    `report-details-${index}`
                                );


                            const wasOpen =
                                group.classList
                                    .contains(
                                        'open'
                                    );


                            container
                                .querySelectorAll(
                                    '.report-group'
                                )
                                .forEach(
                                    item => {

                                        item.classList
                                            .remove(
                                                'open'
                                            );

                                    }
                                );


                            container
                                .querySelectorAll(
                                    '.report-group-details'
                                )
                                .forEach(
                                    item => {

                                        item.classList
                                            .remove(
                                                'show'
                                            );

                                    }
                                );


                            if (
                                !wasOpen
                            ) {

                                group.classList
                                    .add(
                                        'open'
                                    );


                                details.classList
                                    .add(
                                        'show'
                                    );

                            }

                        }
                    );

                }
            );


    } catch (error) {

        console.error(
            'ALL REPORTS ERROR:',
            error
        );


        if (
            $('allReportsTable')
        ) {

            $('allReportsTable').innerHTML = `

                <div class="error-state">

                    ${escapeHtml(
                        error.message
                    )}

                </div>

            `;

        }

    }

}


/* ============================================================
   MANAGEMENT
============================================================ */

async function loadManagement() {

    const container =
        $('managementTable');


    if (
        !container
    ) {

        return;

    }


    try {

        const data =
            await api(
                '/api/admin/users'
            );


        const users =
            Array.isArray(
                data.users
            )
                ? data.users
                : [];


        if (
            !users.length
        ) {

            container.innerHTML = `

                <div class="empty-reports">

                    Користувачів поки немає

                </div>

            `;

            return;

        }


        let html = `

            <div class="table-scroll">

                <table>

                    <thead>

                        <tr>

                            <th>
                                Ім'я
                            </th>

                            <th>
                                Логін
                            </th>

                            <th>
                                Роль
                            </th>

                            <th>
                                Здано звітів
                            </th>

                            <th>
                                Відпрацьовано
                            </th>

                            <th>
                                Заробіток
                            </th>

                            <th>
                                Статус
                            </th>

                            <th>
                                Керування
                            </th>

                        </tr>

                    </thead>


                    <tbody>

        `;


        users.forEach(
            user => {

                let actions =
                    '';


                /*
                   Нельзя менять или удалять
                   главный admin.
                */

                if (
                    user.login ===
                    'admin'
                ) {

                    actions = `

                        <span class="small-muted">

                            Основний адміністратор

                        </span>

                    `;

                } else {

                    /*
                       Роль.
                    */

                    if (
                        user.role ===
                        'admin'
                    ) {

                        actions += `

                            <button
                                type="button"
                                class="small-button"
                                onclick="window.demoteUser(${user.id})"
                            >

                                Забрати адміна

                            </button>

                        `;

                    } else {

                        actions += `

                            <button
                                type="button"
                                class="small-button primary-small"
                                onclick="window.promoteUser(${user.id})"
                            >

                                Зробити адміном

                            </button>

                        `;

                    }


                    /*
                       Статус.
                    */

                    if (
                        user.active
                    ) {

                        actions += `

                            <button
                                type="button"
                                class="small-button danger-small"
                                onclick="deleteEmployee(${user.id})"
                            >

                                Деактивувати

                            </button>

                        `;

                    } else {

                        actions += `

                            <button
                                type="button"
                                class="small-button primary-small"
                                onclick="activateEmployee(${user.id})"
                            >

                                Активувати

                            </button>


                            <button
                                type="button"
                                class="small-button danger-small"
                                onclick="deleteEmployeeCompletely(
                                    ${user.id},
                                    '${escapeHtml(
                                        user.name
                                    )}'
                                )"
                            >

                                Видалити акаунт

                            </button>

                        `;

                    }

                }


                html += `

                    <tr>

                        <td>

                            <b>

                                ${escapeHtml(
                                    user.name ||
                                    '—'
                                )}

                            </b>

                        </td>


                        <td>

                            ${escapeHtml(
                                user.login ||
                                ''
                            )}

                        </td>


                        <td>

                            ${escapeHtml(
                                roleText(
                                    user.role
                                )
                            )}

                        </td>


                        <td>

                            ${Number(
                                user.report_count ||
                                0
                            )}

                        </td>


                        <td>

                            ${Number(
                                user.total_hours ||
                                0
                            ).toFixed(
                                2
                            )}

                            год

                        </td>


                        <td>

                            ${money(
                                user.total_earnings
                            )}

                        </td>


                        <td>

                            ${
                                user.active

                                    ? `

                                        <span class="status-active">
                                            Активний
                                        </span>

                                      `

                                    : `

                                        <span class="status-inactive">
                                            Неактивний
                                        </span>

                                      `
                            }

                        </td>


                        <td>

                            <div class="action-buttons">

                                ${actions}

                            </div>

                        </td>

                    </tr>

                `;

            }
        );


        html += `

                    </tbody>

                </table>

            </div>

        `;


        container.innerHTML =
            html;


    } catch (error) {

        console.error(
            'MANAGEMENT ERROR:',
            error
        );


        container.innerHTML = `

            <div class="error-state">

                ${escapeHtml(
                    error.message
                )}

            </div>

        `;

    }

}


/* ============================================================
   WORK TABLE
============================================================ */

async function loadWorkTable() {

    try {

        const data =
            await api(
                '/api/work-types'
            );


        const works =
            Array.isArray(
                data
            )
                ? data
                : (
                    Array.isArray(
                        data.workTypes
                    )
                        ? data.workTypes
                        : []
                );


        if (
            !$('workTable')
        ) {

            return;

        }


        $('workTable').innerHTML =
            basicTable(

                [
                    'Завдання',
                    'Норма/год',
                    'Ставка/год',
                    'Дія'
                ],


                works.map(
                    work => `

                        <tr>

                            <td>

                                ${escapeHtml(
                                    work.name
                                )}

                            </td>


                            <td>

                                ${Number(
                                    work.norm ||
                                    0
                                ).toFixed(
                                    0
                                )}

                            </td>


                            <td>

                                ${Number(
                                    work.rate ||
                                    0
                                ).toFixed(
                                    2
                                )} ₴

                            </td>


                            <td>

                                <button
                                    type="button"
                                    class="danger-button"
                                    onclick="deleteWork(${work.id})"
                                >

                                    Видалити

                                </button>

                            </td>

                        </tr>

                    `
                )

            );


    } catch (error) {

        console.error(
            'WORK TABLE ERROR:',
            error
        );


        if (
            $('workTable')
        ) {

            $('workTable').innerHTML = `

                <div class="error-state">

                    ${escapeHtml(
                        error.message
                    )}

                </div>

            `;

        }

    }

}


/* ============================================================
   ADD WORK
============================================================ */

if (
    $('workForm')
) {

    $('workForm').addEventListener(
        'submit',
        async event => {

            event.preventDefault();


            if (
                !me ||
                (
                    me.role !==
                    'admin' &&
                    me.role !==
                    'superadmin'
                )
            ) {

                alert(
                    'Недостатньо прав'
                );

                return;

            }


            const name =
                $('wname')
                    .value
                    .trim();


            const norm =
                Number(
                    $('wnorm')
                        .value
                );


            const rate =
                Number(
                    $('wrate')
                        .value
                );


            try {

                await api(
                    '/api/admin/work-types',
                    {

                        method:
                            'POST',

                        body:
                            JSON.stringify({

                                name,
                                norm,
                                rate

                            })

                    }
                );


                event.target.reset();


                await loadWorkTypes();


                await loadWorkTable();


                alert(
                    'Завдання додано'
                );


            } catch (error) {

                alert(
                    error.message
                );

            }

        }
    );

}


/* ============================================================
   DELETE WORK
============================================================ */

async function deleteWork(
    workId
) {

    if (
        !me ||
        (
            me.role !==
            'admin' &&
            me.role !==
            'superadmin'
        )
    ) {

        alert(
            'Недостатньо прав'
        );

        return;

    }


    if (
        !confirm(
            'Ви дійсно хочете видалити це завдання?\nСтарі звіти залишаться.'
        )
    ) {

        return;

    }


    try {

        await api(
            `/api/admin/work-types/${workId}`,
            {
                method:
                    'DELETE'
            }
        );


        alert(
            'Завдання видалено'
        );


        await loadWorkTypes();


        await loadWorkTable();


    } catch (error) {

        alert(
            error.message
        );

    }

}


/* ============================================================
   EXCEL
============================================================ */

async function exportExcel() {

    try {

        const response =
            await fetch(
                '/api/admin/export-excel',
                {
                    credentials:
                        'same-origin'
                }
            );


        if (
            !response.ok
        ) {

            const data =
                await response
                    .json()
                    .catch(
                        () => ({})
                    );


            throw new Error(
                data.error ||
                'Не вдалося створити Excel-файл'
            );

        }


        const blob =
            await response.blob();


        const url =
            window.URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                'a'
            );


        link.href =
            url;


        link.download =
            `WorkTrack_${today()}.xlsx`;


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        window.URL.revokeObjectURL(
            url
        );


    } catch (error) {

        alert(
            error.message
        );

    }

}


/* ============================================================
   ADD REPORT ITEM BUTTON
============================================================ */

if (
    $('addReportItem')
) {

    $('addReportItem').addEventListener(
        'click',
        () => {

            if (
                workTypes.length ===
                0
            ) {

                alert(
                    'Спочатку адміністратор повинен додати завдання'
                );

                return;

            }


            addReportItem();

        }
    );

}


/* ============================================================
   AUTH START STATE
============================================================ */

document.body.classList.add(
    'auth-mode'
);


if (
    $('auth')
) {

    $('auth')
        .classList
        .remove(
            'hidden'
        );

}


if (
    $('app')
) {

    $('app')
        .classList
        .add(
            'hidden'
        );

}


/* ============================================================
   INIT
============================================================ */

if (
    $('rdate')
) {

    $('rdate').value =
        today();

}


if (
    $('reportItems') &&
    $('reportItems').children.length ===
    0
) {

    addReportItem();

}


boot();