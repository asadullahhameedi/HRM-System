const User = require('./User');
const Employee = require('./Employee');
const Department = require('./Department');
const Designation = require('./Designation');
const Attendance = require('./Attendance');
const Leave = require('./Leave');
const LeaveType = require('./LeaveType');
const Holiday = require('./Holiday');
const PayrollPeriod = require('./PayrollPeriod');
const SalaryStructure = require('./SalaryStructure');
const Payroll = require('./Payroll');
const Payslip = require('./Payslip');
const Loan = require('./Loan');
const AuditLog = require('./AuditLog');
const Developer = require('./Developer');
const Task = require('./Task');
const Document = require('./Document');
const Setting = require('./Setting');
const Reimbursement = require('./Reimbursement');
const Commission = require('./Commission');
const OvertimeRecord = require('./OvertimeRecord');

module.exports = {
  User, Employee, Department, Designation, Attendance, Leave, LeaveType,
  Holiday, PayrollPeriod, SalaryStructure, Payroll, Payslip, Loan, AuditLog,
  Developer, Task, Document,
  Setting, Reimbursement, Commission, OvertimeRecord,
};
