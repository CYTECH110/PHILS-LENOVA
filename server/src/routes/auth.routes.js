const express = require('express');
const { login, logout, me, updateProfile, changePassword, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.post('/login', login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);
router.put('/profile', requireAuth, updateProfile);
router.post('/change-password', requireAuth, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;

