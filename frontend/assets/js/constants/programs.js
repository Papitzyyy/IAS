/**
 * EVSU Ormoc Campus — programs grouped by department.
 * Keep in sync with backend/app/constants/programs.py
 *
 * NOTE: All codes are UPPERCASE to match backend .upper() normalization.
 */
var EVSU_PROGRAMS = [
  {
    department: "Engineering Department",
    programs: [
      { code: "BSCE", label: "BSCE – Bachelor of Science in Civil Engineering" },
      { code: "BSEE", label: "BSEE – Bachelor of Science in Electrical Engineering" },
      { code: "BSME", label: "BSME – Bachelor of Science in Mechanical Engineering" },
    ],
  },
  {
    department: "Information Technology Department",
    programs: [
      { code: "BSIT", label: "BSIT – Bachelor of Science in Information Technology" },
    ],
  },
  {
    department: "Industrial Technology Department",
    programs: [
      { code: "BSHM", label: "BSHM – Bachelor of Science in Hospitality Management" },
    ],
  },
  {
    department: "Teacher Education Department",
    programs: [
      { code: "BEED", label: "BEED – Bachelor in Elementary Education" },
      { code: "BSED", label: "BSEd – Bachelor of Secondary Education (Majors: Mathematics, Science)" },
      { code: "BCAED", label: "BCAEd – Bachelor of Culture & Arts Education" },
      { code: "BPED", label: "BPEd – Bachelor of Physical Education" },
    ],
  },
];

function buildProgramSelectOptions(selectedCode) {
  var html = '<option value="">— Select program —</option>';
  EVSU_PROGRAMS.forEach(function (dept) {
    html += '<optgroup label="' + dept.department + '">';
    dept.programs.forEach(function (p) {
      var sel = p.code === (selectedCode || "").toUpperCase() ? " selected" : "";
      html += '<option value="' + p.code + '"' + sel + ">" + p.label + "</option>";
    });
    html += "</optgroup>";
  });
  return html;
}
