const mongoose = require('mongoose');
const { Schema } = mongoose;

const developerSchema = new Schema(
  {
    key: { type: String, default: 'developer', unique: true },
    fullName: { type: String, default: 'Asadullah Hameedi' },
    brandName: { type: String, default: 'AH' },
    professionalRole: { type: String, default: 'Full-Stack Developer' },
    tagline: { type: String, default: 'Building robust, scalable web applications with modern technologies.' },
    about: { type: String, default: 'Full-Stack Developer specializing in Node.js, Express, MongoDB, and modern frontend frameworks.' },
    email: { type: String, default: 'asadullah.hameedi@example.com' },
    phone: { type: String, default: '+93 798 60 10 10' },
    whatsapp: { type: String, default: '+93 798 60 10 10' },
    location: { type: String, default: 'Kabul, Afghanistan' },
    github: { type: String, default: 'https://github.com/asadullahhameedi' },
    linkedin: { type: String, default: 'https://linkedin.com/in/asadullahhameedi' },
    twitter: { type: String, default: '' },
    skills: [{ type: String }],
    education: { type: String, default: 'B.Sc. in Computer Science' },
    careerGoal: { type: String, default: 'To architect and build enterprise-grade software systems that drive organizational efficiency and growth.' },
    avatar: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Developer', developerSchema);
