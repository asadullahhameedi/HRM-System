const asyncHandler = require('../utils/asyncHandler');
const defaults = require('../config/defaults');
const env = require('../config/env');

/**
 * About page — modern, focused view with only:
 *   1. Application Information & Key Features
 *   2. Team Members (one unified section — everyone is a team member)
 *   3. Technology Stack
 *
 * ============================================================
 *  EDITABLE TEAM MEMBER DATA
 * ============================================================
 *  All team member information is defined below in the
 *  TEAM_MEMBERS array. To update any name, role, photo,
 *  description, skills, or social links, simply edit the
 *  values here — no UI/template changes needed.
 *
 *  Each person object supports the following fields:
 *    name        (String, required)  — Full display name
 *    initials    (String, required)  — 2-letter initials for the avatar fallback
 *    role        (String, required)  — Professional role / job title
 *    bio         (String, required)  — Short description (1-2 sentences)
 *    photo       (String, optional)  — URL to a profile photo. If empty, initials avatar is shown.
 *    color       (String, required)  — Tailwind gradient classes for the banner/avatar, e.g. 'from-brand-500 to-violet-600'
 *    accent      (String, required)  — Accent key: 'brand' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet'
 *    featured    (Boolean, optional) — Show a "Lead" badge on the card
 *    skills      (Array, optional)   — List of skill chips
 *    location    (String, optional)  — City, Country
 *    socials     (Object, optional)  — { github, linkedin, twitter, email, whatsapp, phone }
 *                                      Any social can be omitted/empty to hide its icon.
 * ============================================================
 */

// ---- Team Members — all in one unified list, editable from code ----
const TEAM_MEMBERS = [
  {
    name: 'Asadullah Hameedi',
    initials: 'AH',
    role: 'Lead Developer & Full-Stack Engineer',
    bio: 'Architects and builds the core platform — from the payroll engine and security layer to the premium UI. Specializes in Node.js, Express, MongoDB, and modern frontend frameworks.',
    photo: '', // Optional: set a URL like '/uploads/team-ah.jpg' to show a photo instead of initials
    color: 'from-brand-500 to-violet-600',
    accent: 'brand',
    featured: true,
    skills: ['Node.js', 'Express', 'MongoDB', 'EJS', 'Tailwind CSS', 'JavaScript', 'Git'],
    location: 'Kabul, Afghanistan',
    socials: {
      github: 'https://github.com/asadullahhameedi',
      linkedin: 'https://linkedin.com/in/asadullahhameedi',
      twitter: '',
      email: 'asadullah.hameedi@example.com',
      whatsapp: '+93 798 60 10 10',
      phone: '+93 798 60 10 10',
    },
  },
  {
    name: 'Amrullah Omari',
    initials: 'AO',
    role: 'System Architect & Lead Developer',
    bio: 'Designs and builds the core architecture, payroll engine, and security layer of the HRM system. Ensures scalability and performance across all modules.',
    photo: '', // Optional: set a URL to show a photo
    color: 'from-emerald-500 to-teal-600',
    accent: 'emerald',
    featured: false,
    skills: ['Architecture', 'Node.js', 'Security', 'MongoDB'],
    location: 'Kabul, Afghanistan',
    socials: {
      github: '#',
      linkedin: '#',
      twitter: '',
      email: '',
      whatsapp: '',
      phone: '',
    },
  },
  {
    name: 'Hedayatullah Obaidi',
    initials: 'HO',
    role: 'Full-Stack Developer',
    bio: 'Implements employee management, attendance, leave workflows, and the user interface. Focuses on clean code and intuitive user experiences.',
    photo: '', // Optional: set a URL to show a photo
    color: 'from-amber-500 to-orange-600',
    accent: 'amber',
    featured: false,
    skills: ['React', 'EJS', 'Tailwind', 'Express'],
    location: 'Kabul, Afghanistan',
    socials: {
      github: '#',
      linkedin: '#',
      twitter: '',
      email: '',
      whatsapp: '',
      phone: '',
    },
  },
];

const index = asyncHandler(async (req, res) => {
  const settings = defaults;

  // ---- Team Members (unified — everyone is a team member) ----
  const team = TEAM_MEMBERS;

  // ---- Key features (with accent colors for visual variety) ----
  const features = [
    { icon: 'fa-users', title: 'Employee Management', desc: 'Centralized records with automatic ID generation, documents, and history timeline.', accent: 'brand' },
    { icon: 'fa-building', title: 'Departments & Designations', desc: 'Master data with full CRUD, activation control, and live employee counts.', accent: 'emerald' },
    { icon: 'fa-clock', title: 'Attendance Tracking', desc: 'Daily attendance, overtime, late tracking, and bulk import capabilities.', accent: 'amber' },
    { icon: 'fa-calendar-days', title: 'Leave Management', desc: 'Multi-type leave with balance tracking and approval workflow.', accent: 'rose' },
    { icon: 'fa-money-bill-wave', title: 'Enterprise Payroll', desc: 'Salary structures, overtime, bonuses, loans, taxes, and one-click runs with PDF payslips.', accent: 'sky' },
    { icon: 'fa-list-check', title: 'Task Management', desc: 'Personal, team, and department tasks with a Kanban board and progress tracking.', accent: 'violet' },
    { icon: 'fa-chart-line', title: 'Analytics Dashboard', desc: 'Interactive charts for headcount, attendance, and payroll trends.', accent: 'emerald' },
    { icon: 'fa-shield-halved', title: 'Security & Audit', desc: 'Role-based access control, bcrypt hashing, secure sessions, and immutable audit logs.', accent: 'brand' },
  ];

  // ---- Application meta (for the info card) ----
  const appMeta = [
    { icon: 'fa-tag', label: 'Version', value: 'v1.3.0' },
    { icon: 'fa-circle-check', label: 'Status', value: 'Stable' },
    { icon: 'fa-scale-balanced', label: 'License', value: 'MIT' },
    { icon: 'fa-calendar', label: 'Released', value: '2025' },
  ];

  const quickStats = [
    { label: 'Modules', value: '10+' },
    { label: 'DB Models', value: '21' },
    { label: 'User Roles', value: '5' },
    { label: 'License', value: 'MIT' },
  ];

  // ---- Technology stack grouped into interactive categories ----
  const techGroups = [
    {
      id: 'frontend',
      label: 'Frontend',
      icon: 'fa-code',
      desc: 'Templating, styling, and client-side tooling.',
      items: [
        { name: 'EJS', version: '3.x', icon: 'fa-code', color: 'text-amber-600', desc: 'Server-side templating' },
        { name: 'Tailwind CSS', version: '3.x', icon: 'fa-wind', color: 'text-sky-500', desc: 'Utility-first styling' },
        { name: 'Font Awesome', version: '6.5', icon: 'fa-font-awesome', color: 'text-blue-600', desc: 'Icon system' },
        { name: 'Chart.js', version: '4.x (CDN)', icon: 'fa-chart-bar', color: 'text-violet-600', desc: 'Dashboard charts (loaded via CDN)' },
        { name: 'Inter Font', version: '—', icon: 'fa-text-height', color: 'text-slate-600', desc: 'Typography' },
      ],
    },
    {
      id: 'backend',
      label: 'Backend & Data',
      icon: 'fa-server',
      desc: 'Runtime, framework, data layer, and security.',
      items: [
        { name: 'Node.js', version: '18+', icon: 'fa-node-js', color: 'text-green-600', desc: 'JavaScript runtime' },
        { name: 'Express.js', version: '4.x', icon: 'fa-server', color: 'text-slate-700', desc: 'Web framework' },
        { name: 'MongoDB', version: '7.x', icon: 'fa-database', color: 'text-green-700', desc: 'Document database' },
        { name: 'Mongoose', version: '8.x', icon: 'fa-link', color: 'text-red-600', desc: 'ODM & validation' },
        { name: 'Passport.js', version: '0.7', icon: 'fa-shield', color: 'text-emerald-600', desc: 'Authentication' },
        { name: 'bcryptjs', version: '2.x', icon: 'fa-lock', color: 'text-rose-600', desc: 'Password hashing' },
      ],
    },
    {
      id: 'tools',
      label: 'Tools & Libraries',
      icon: 'fa-toolbox',
      desc: 'Exporting, validation, and developer tooling.',
      items: [
        { name: 'PDFKit', version: '0.15', icon: 'fa-file-pdf', color: 'text-red-700', desc: 'PDF payslip generation' },
        { name: 'xlsx', version: '0.18', icon: 'fa-file-excel', color: 'text-green-600', desc: 'Excel exports' },
        { name: 'express-validator', version: '7.x', icon: 'fa-circle-check', color: 'text-blue-600', desc: 'Input validation' },
        { name: 'Multer', version: '1.x', icon: 'fa-upload', color: 'text-amber-600', desc: 'File uploads' },
        { name: 'Helmet', version: '7.x', icon: 'fa-shield-halved', color: 'text-slate-600', desc: 'HTTP security headers' },
        { name: 'method-override', version: '3.x', icon: 'fa-arrows-rotate', color: 'text-violet-600', desc: 'PUT/DELETE in forms' },
      ],
    },
  ];

  res.render('about/index', {
    title: 'About',
    team,
    features,
    appMeta,
    quickStats,
    techGroups,
    settings,
    version: '1.3.0',
    appName: env.appName,
  });
});

module.exports = { index };
