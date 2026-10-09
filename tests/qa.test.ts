import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import app from '../src/app';
import { pool, query } from '../src/config/db';
import { signToken, verifyToken } from '../src/utils/jwt';

let server: Server;
let baseUrl: string;

// Unique timestamp for isolated QA test run
const testId = Date.now();
const candidateEmail = `qa.candidate.${testId}@test.com`;
const employerEmail = `qa.employer.${testId}@test.com`;
const testPassword = 'TestPassword123!';

let candidateToken = '';
let candidateUserId = '';
let employerToken = '';
let employerUserId = '';
let testJobId = '';

before(async () => {
  server = app.listen(0);
  const addr = server.address() as any;
  baseUrl = `http://localhost:${addr.port}`;
});

after(async () => {
  // Clean up any test records created during QA run
  try {
    if (testJobId) {
      await query('DELETE FROM jobs WHERE id = $1', [testJobId]);
    }
    await query('DELETE FROM candidate_profiles WHERE user_id IN ($1, $2)', [candidateUserId, employerUserId]);
    await query('DELETE FROM companies WHERE user_id IN ($1, $2)', [candidateUserId, employerUserId]);
    await query('DELETE FROM users WHERE email IN ($1, $2)', [candidateEmail, employerEmail]);
  } catch (err) {
    // Ignore cleanup errors
  }

  // Close server and database pool
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

// ==========================================
// 1. SYSTEM & HEALTH CHECK QA
// ==========================================
test('QA System: Root endpoint returns welcome payload', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200, 'Root endpoint should return HTTP 200');
  const data = await res.json();
  assert.equal(data.message, 'Welcome to RonoJobs API');
  assert.ok(data.version, 'Should include API version');
});

test('QA System: Health check verifies DB connection', async () => {
  const res = await fetch(`${baseUrl}/api/v1/health`);
  assert.equal(res.status, 200, 'Health check should return HTTP 200 when DB is active');
  const data = await res.json();
  assert.equal(data.status, 'healthy');
  assert.equal(data.database, 'connected');
  assert.equal(data.service, 'RonoJobs API');
});

test('QA System: Non-existent routes return structured 404 JSON', async () => {
  const res = await fetch(`${baseUrl}/api/v1/undefined-route-check`);
  assert.equal(res.status, 404, 'Unknown endpoint should return HTTP 404');
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.message, 'Endpoint not found');
});

test('QA System: Metadata skills & categories endpoints', async () => {
  const skillsRes = await fetch(`${baseUrl}/api/v1/meta/skills`);
  assert.equal(skillsRes.status, 200);
  const skillsData = await skillsRes.json();
  assert.equal(skillsData.success, true);
  assert.ok(Array.isArray(skillsData.data), 'Skills data should be an array');

  const catRes = await fetch(`${baseUrl}/api/v1/meta/categories`);
  assert.equal(catRes.status, 200);
  const catData = await catRes.json();
  assert.equal(catData.success, true);
  assert.ok(Array.isArray(catData.data), 'Categories data should be an array');
});

// ==========================================
// 2. SECURITY & AUTHENTICATION QA
// ==========================================
test('QA Auth: JWT signature verification and tamper rejection', async () => {
  const validToken = signToken({
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'security.check@ronojobs.com',
    role: 'candidate',
  });
  const decoded = verifyToken(validToken);
  assert.equal(decoded.email, 'security.check@ronojobs.com');

  // Tamper with signature
  const parts = validToken.split('.');
  const tamperedToken = `${parts[0]}.${parts[1]}.tamperedSignature`;
  assert.throws(() => verifyToken(tamperedToken), 'Tampered token must throw verification error');
});

test('QA Auth: Registration rejects invalid payload (missing fields / bad role)', async () => {
  // Missing password
  const resNoPass = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: candidateEmail }),
  });
  assert.equal(resNoPass.status, 400, 'Missing password should return 400 Bad Request');

  // Invalid role
  const resBadRole = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: candidateEmail,
      password: testPassword,
      role: 'superadmin',
    }),
  });
  assert.equal(resBadRole.status, 400, 'Invalid role should return 400 Bad Request');
});

test('QA Auth: Candidate registration succeeds and returns JWT', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: candidateEmail,
      password: testPassword,
      role: 'candidate',
      fullName: 'QA Test Candidate',
    }),
  });

  assert.equal(res.status, 201, 'Valid candidate registration should return 201 Created');
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.token, 'Response must include JWT token');
  assert.equal(body.user.email, candidateEmail.toLowerCase());
  assert.equal(body.user.role, 'candidate');

  candidateToken = body.token;
  candidateUserId = body.user.id;
});

test('QA Auth: Duplicate registration prevents duplicate email (409 Conflict)', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: candidateEmail,
      password: testPassword,
      role: 'candidate',
    }),
  });

  assert.equal(res.status, 409, 'Duplicate email registration should return 409 Conflict');
  const body = await res.json();
  assert.equal(body.success, false);
});

test('QA Auth: Login verification (wrong password vs correct credentials)', async () => {
  // Wrong password
  const resWrong = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: candidateEmail, password: 'WrongPassword999!' }),
  });
  assert.equal(resWrong.status, 401, 'Wrong password must return 401 Unauthorized');

  // Correct credentials
  const resCorrect = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: candidateEmail, password: testPassword }),
  });
  assert.equal(resCorrect.status, 200, 'Correct login must return 200 OK');
  const body = await resCorrect.json();
  assert.equal(body.success, true);
  assert.ok(body.token, 'Login must issue token');
  assert.equal(body.user.email, candidateEmail.toLowerCase());
});

test('QA Auth: Protected profile endpoint GET /api/v1/auth/me', async () => {
  // No token
  const resUnauth = await fetch(`${baseUrl}/api/v1/auth/me`);
  assert.equal(resUnauth.status, 401, 'Accessing /auth/me without token should return 401');

  // Valid token
  const resAuth = await fetch(`${baseUrl}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${candidateToken}` },
  });
  assert.equal(resAuth.status, 200, 'Accessing /auth/me with token should return 200');
  const body = await resAuth.json();
  assert.equal(body.success, true);
  assert.equal(body.user.id, candidateUserId);
  assert.equal(body.user.email, candidateEmail.toLowerCase());
});

// ==========================================
// 3. ROLE-BASED ACCESS CONTROL (RBAC) QA
// ==========================================
test('QA RBAC: Candidate cannot perform Employer actions (403 Forbidden)', async () => {
  // Candidate trying to post a job
  const resPostJob = await fetch(`${baseUrl}/api/v1/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${candidateToken}`,
    },
    body: JSON.stringify({
      title: 'Hacked Job Title',
      description: 'Candidate posting job illegally',
    }),
  });
  assert.equal(resPostJob.status, 403, 'Candidate posting job must return 403 Forbidden');

  // Candidate trying to view employer dashboard stats
  const resStats = await fetch(`${baseUrl}/api/v1/employer/stats`, {
    headers: { Authorization: `Bearer ${candidateToken}` },
  });
  assert.equal(resStats.status, 403, 'Candidate accessing employer stats must return 403 Forbidden');
});

// ==========================================
// 4. PUBLIC JOBS FEED & SEARCH QA
// ==========================================
test('QA Jobs: GET /api/v1/jobs returns paginated job feed', async () => {
  const res = await fetch(`${baseUrl}/api/v1/jobs?page=1&limit=5`);
  assert.equal(res.status, 200, 'Jobs list should return 200 OK');
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data), 'Jobs data should be an array');
  assert.ok(body.pagination, 'Pagination metadata must be present');
  assert.ok(typeof body.pagination.total === 'number');
  assert.equal(body.pagination.limit, 5);
});

test('QA Jobs: GET /api/v1/jobs/:id handles non-existent or invalid UUIDs cleanly', async () => {
  const resNonExistent = await fetch(`${baseUrl}/api/v1/jobs/00000000-0000-0000-0000-000000000000`);
  assert.equal(resNonExistent.status, 404, 'Non-existent job UUID should return 404 Not Found');

  const resInvalid = await fetch(`${baseUrl}/api/v1/jobs/not-a-valid-uuid`);
  assert.ok([400, 404, 500].includes(resInvalid.status), 'Invalid UUID should not crash the server');
});

// ==========================================
// 5. EMPLOYER LIFECYCLE QA (Register -> Post Job -> Verify -> Delete)
// ==========================================
test('QA Employer: Full job lifecycle', async () => {
  // 1. Register Employer
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: employerEmail,
      password: testPassword,
      role: 'employer',
      companyName: 'QA Systems Global',
    }),
  });
  assert.equal(regRes.status, 201, 'Employer registration should return 201 Created');
  const regBody = await regRes.json();
  employerToken = regBody.token;
  employerUserId = regBody.user.id;

  // 2. Post a new Job as Employer
  const postJobRes = await fetch(`${baseUrl}/api/v1/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employerToken}`,
    },
    body: JSON.stringify({
      title: 'QA Senior Automation Engineer',
      description: 'End-to-end testing of distributed systems and mobile APIs.',
      category: 'Engineering',
      employment_type: 'Full-time',
      location: 'Remote',
      experience_level: 'Senior',
      skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
      salary_min: 90000,
      salary_max: 130000,
    }),
  });
  assert.equal(postJobRes.status, 201, 'Employer creating job should return 201 Created');
  const jobBody = await postJobRes.json();
  assert.equal(jobBody.success, true);
  assert.ok(jobBody.data.id, 'Created job must have an ID');
  assert.equal(jobBody.data.title, 'QA Senior Automation Engineer');
  testJobId = jobBody.data.id;

  // 3. Verify Job exists in Employer's own dashboard
  const empJobsRes = await fetch(`${baseUrl}/api/v1/employer/jobs`, {
    headers: { Authorization: `Bearer ${employerToken}` },
  });
  assert.equal(empJobsRes.status, 200);
  const empJobsBody = await empJobsRes.json();
  const foundInEmployer = empJobsBody.data.some((j: any) => j.id === testJobId);
  assert.ok(foundInEmployer, 'Newly created job must appear in employer jobs list');

  // 4. Verify Employer Stats
  const statsRes = await fetch(`${baseUrl}/api/v1/employer/stats`, {
    headers: { Authorization: `Bearer ${employerToken}` },
  });
  assert.equal(statsRes.status, 200);
  const statsBody = await statsRes.json();
  assert.equal(statsBody.success, true);
  assert.ok(statsBody.data.total_jobs >= 1, 'Total jobs stat should reflect created job');

  // 5. Delete Job
  const delRes = await fetch(`${baseUrl}/api/v1/jobs/${testJobId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${employerToken}` },
  });
  assert.equal(delRes.status, 200, 'Employer deleting job should return 200 OK');
  testJobId = ''; // Cleared so after() doesn't need to re-delete
});
