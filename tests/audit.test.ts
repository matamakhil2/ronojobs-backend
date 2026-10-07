import test from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken } from '../src/utils/jwt';
import { requireRole } from '../src/middleware/auth';
import request from 'http';
import app from '../src/app';

test('Security: JWT signing and verification', async () => {
  const payload = {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'test@ronojobs.com',
    role: 'candidate' as const,
  };

  const token = signToken(payload);
  assert.ok(token, 'Token should be generated');

  const decoded = verifyToken(token);
  assert.equal(decoded.userId, payload.userId);
  assert.equal(decoded.email, payload.email);
  assert.equal(decoded.role, 'candidate');
});

test('RBAC Middleware: Prevents unauthorized role access', async () => {
  const middleware = requireRole('employer', 'admin');

  // Case 1: No user
  let statusCode: number | null = null;
  let responseBody: any = null;
  const mockReqNoUser: any = {};
  const mockRes: any = {
    status(code: number) {
      statusCode = code;
      return {
        json(data: any) {
          responseBody = data;
        },
      };
    },
  };

  let nextCalled = false;
  middleware(mockReqNoUser, mockRes, () => {
    nextCalled = true;
  });
  assert.equal(statusCode, 401, 'Unauthenticated request should return 401');
  assert.equal(nextCalled, false, 'Next should not be called');

  // Case 2: Candidate trying to access employer route
  statusCode = null;
  const mockReqCandidate: any = {
    user: { userId: '123', email: 'c@test.com', role: 'candidate' },
  };
  middleware(mockReqCandidate, mockRes, () => {
    nextCalled = true;
  });
  assert.equal(statusCode, 403, 'Candidate accessing employer route should return 403 Forbidden');
  assert.equal(nextCalled, false, 'Next should not be called for candidate');

  // Case 3: Employer accessing employer route
  statusCode = null;
  nextCalled = false;
  const mockReqEmployer: any = {
    user: { userId: '123', email: 'e@test.com', role: 'employer' },
  };
  middleware(mockReqEmployer, mockRes, () => {
    nextCalled = true;
  });
  assert.equal(statusCode, null, 'No error status should be sent');
  assert.equal(nextCalled, true, 'Next should be called for authorized employer');
});

test('HTTP API: Health check endpoint', async () => {
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    const res = await fetch(`http://localhost:${port}/api/v1/health`);
    assert.ok(
      res.status === 200 || res.status === 503,
      `Health check status should be 200 (DB healthy) or 503 (DB disconnected), received: ${res.status}`
    );
    const body: any = await res.json();
    assert.ok(body.service === 'RonoJobs API', 'Service name should match');
    assert.ok(body.status === 'healthy' || body.status === 'unhealthy');
  } finally {
    server.close();
  }
});
