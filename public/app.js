$(document).ready(function () {
    initWeeks();
    loadGroups();
    loadCurrentWeek();

    $("#mode").on("change", function () {
        const mode = $(this).val();

        if (mode === "group") {
            $("#groupField").removeClass("hidden");
            $("#teacherField").addClass("hidden");
        } else {
            $("#groupField").addClass("hidden");
            $("#teacherField").removeClass("hidden");
        }
    });

    $("#loadBtn").on("click", function () {
        loadSchedule();
    });
});

function initWeeks() {
    const $weekSelect = $("#weekSelect");

    for (let i = 1; i <= 52; i++) {
        $weekSelect.append(`<option value="${i}">${i}</option>`);
    }
}

function loadGroups() {
    $.getJSON("/api/groups")
        .done(function (groups) {
            const $groupSelect = $("#groupSelect");
            $groupSelect.empty();

            groups.forEach(group => {
                $groupSelect.append(
                    `<option value="${group.id}">${group.name}</option>`
                );
            });
        })
        .fail(function () {
            showStatus("Не удалось загрузить список групп", true);
        });
}

function loadCurrentWeek() {
    $.getJSON("/api/current-week")
        .done(function (data) {
            $("#weekSelect").val(data.week);
        })
        .fail(function () {
            $("#weekSelect").val("1");
        });
}

function loadSchedule() {
    const mode = $("#mode").val();
    const week = $("#weekSelect").val();

    showStatus("Загрузка расписания...", false);
    $("#scheduleGrid").empty();
    $("#scheduleInfo").empty();

    if (mode === "group") {
        const groupId = $("#groupSelect").val();

        $.getJSON(`/api/schedule/group/${groupId}?week=${week}`)
            .done(function (data) {
                renderInfo(data);
                renderSchedule(data);
                showStatus("Расписание успешно загружено", false);
            })
            .fail(function () {
                showStatus("Ошибка загрузки расписания по группе", true);
            });

    }
}

function renderInfo(data) {
    let html = "";

    if (data.mode === "group") {
        html = `
      <h2>${data.groupName || "Группа"}</h2>
      <p>Идентификатор группы: ${data.groupId}</p>
      <p>Учебная неделя: ${data.week}</p>
    `;
    } else {
        html = `
      <h2>Преподаватель: ${data.teacher}</h2>
      <p>Учебная неделя: ${data.week}</p>
    `;
    }

    $("#scheduleInfo").html(html);
}

function renderSchedule(data) {
    const $grid = $("#scheduleGrid");
    $grid.empty();

    data.days.forEach(day => {
        let lessonsHtml = "";

        if (!day.lessons || day.lessons.length === 0) {
            lessonsHtml = `<p class="empty-day">Нет занятий</p>`;
        } else {
            day.lessons.forEach(lesson => {
                lessonsHtml += `
          <div class="lesson-card ${lesson.type}">
            <h4>${lesson.title}</h4>
            <p><strong>Время:</strong> ${lesson.time}</p>
            <p><strong>Преподаватель:</strong> ${lesson.teacher}</p>
            <p><strong>Аудитория:</strong> ${lesson.room}</p>
            <p><strong>Тип:</strong> ${lesson.type}</p>
          </div>
        `;
            });
        }

        const dayHtml = `
      <div class="day-column">
        <div class="day-header">
          <h3>${day.day}</h3>
          <p>${day.date}</p>
        </div>
        ${lessonsHtml}
      </div>
    `;

        $grid.append(dayHtml);
    });
}

function showStatus(message, isError) {
    const $status = $("#statusBox");
    $status.text(message);

    if (isError) {
        $status.css({
            "border-left-color": "#dc2626",
            "color": "#991b1b"
        });
    } else {
        $status.css({
            "border-left-color": "#2563eb",
            "color": "#1f2937"
        });
    }
}