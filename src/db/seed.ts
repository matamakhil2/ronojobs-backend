import bcrypt from 'bcryptjs';
import { pool } from '../config/db';

export async function runSeeds() {
  console.log('🌱 Seeding database...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Default password hash
    const candidatePass = await bcrypt.hash('Candidate@123', 10);
    const employerPass = await bcrypt.hash('Employer@123', 10);
    const adminPass = await bcrypt.hash('Admin@123', 10);

    // 1. Insert Users
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES 
         ('admin@ronojobs.com', $1, 'admin'),
         ('recruiter@techcorp.com', $2, 'employer'),
         ('talent@fintechpay.com', $2, 'employer'),
         ('alex.dev@gmail.com', $3, 'candidate'),
         ('sarah.ux@gmail.com', $3, 'candidate')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, email, role;`,
      [adminPass, employerPass, candidatePass]
    );

    const userMap: Record<string, string> = {};
    for (const row of userRes.rows) {
      userMap[row.email] = row.id;
    }

    // 2. Candidate Profiles
    if (userMap['alex.dev@gmail.com']) {
      await client.query(
        `INSERT INTO candidate_profiles (user_id, full_name, phone, location, headline, bio, experience_years, education, resume_url, skills)
         VALUES ($1, 'Alex Rivera', '+1 (555) 234-5678', 'San Francisco, CA', 'Senior Full Stack & Mobile Engineer', 
         'Passionate React Native and Node.js developer with 5+ years of building scale consumer applications.',
         5, 'B.S. in Computer Science, UC Berkeley', 'https://ronojobs.com/resumes/alex_rivera_cv.pdf',
         ARRAY['React Native', 'TypeScript', 'Node.js', 'PostgreSQL', 'GraphQL', 'Docker'])
         ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;`,
        [userMap['alex.dev@gmail.com']]
      );
    }

    if (userMap['sarah.ux@gmail.com']) {
      await client.query(
        `INSERT INTO candidate_profiles (user_id, full_name, phone, location, headline, bio, experience_years, education, resume_url, skills)
         VALUES ($1, 'Sarah Chen', '+1 (555) 987-6543', 'New York, NY', 'Lead Product & UI/UX Designer', 
         'Specialized in design systems, micro-interactions, and user-centric mobile UI workflows.',
         4, 'M.S. in Human-Computer Interaction, Carnegie Mellon', 'https://ronojobs.com/resumes/sarah_chen_cv.pdf',
         ARRAY['Figma', 'UI/UX Design', 'Design Systems', 'User Research', 'Prototyping'])
         ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;`,
        [userMap['sarah.ux@gmail.com']]
      );
    }

    // 3. Companies
    let techCorpId: string | undefined;
    let finTechId: string | undefined;

    if (userMap['recruiter@techcorp.com']) {
      const comp1 = await client.query(
        `INSERT INTO companies (user_id, name, logo_url, description, website, location, industry)
         VALUES ($1, 'CloudScale Technologies', 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=200&auto=format&fit=crop&q=80',
         'Building next-generation distributed cloud infrastructure and developer productivity tools.',
         'https://cloudscale.example.com', 'San Francisco, CA / Remote', 'Cloud & DevOps')
         RETURNING id;`,
        [userMap['recruiter@techcorp.com']]
      );
      techCorpId = comp1.rows[0]?.id;
    }

    if (userMap['talent@fintechpay.com']) {
      const comp2 = await client.query(
        `INSERT INTO companies (user_id, name, logo_url, description, website, location, industry)
         VALUES ($1, 'PayPulse Global', 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=200&auto=format&fit=crop&q=80',
         'Democratizing cross-border real-time settlements for modern internet businesses.',
         'https://paypulse.example.com', 'New York, NY / Remote', 'Financial Technology')
         RETURNING id;`,
        [userMap['talent@fintechpay.com']]
      );
      finTechId = comp2.rows[0]?.id;
    }

    // 4. Jobs
    if (techCorpId && userMap['recruiter@techcorp.com']) {
      const j1 = await client.query(
        `INSERT INTO jobs (company_id, employer_id, title, description, category, employment_type, location, experience_level, salary_min, salary_max, salary_currency, skills, status)
         VALUES 
         ($1, $2, 'Senior React Native Developer', 
          'We are seeking an experienced React Native developer to spearhead our next-generation mobile client. You will architect cross-platform navigation, offline synchronization, and smooth 60fps gesture animations.',
          'Mobile Development', 'Remote', 'Remote (US/EU)', 'Senior', 130000, 165000, 'USD',
          ARRAY['React Native', 'Expo', 'TypeScript', 'Redux / Zustand', 'REST API', 'iOS & Android'], 'open'),
         ($1, $2, 'DevOps & Cloud Infrastructure Engineer',
          'Help us maintain our Kubernetes multi-region clusters, automate CI/CD pipelines, and maintain 99.99% system reliability.',
          'DevOps', 'Full-time', 'San Francisco, CA', 'Mid', 120000, 150000, 'USD',
          ARRAY['Kubernetes', 'Docker', 'AWS', 'Terraform', 'PostgreSQL'], 'open')
         RETURNING id;`,
        [techCorpId, userMap['recruiter@techcorp.com']]
      );
    }

    if (finTechId && userMap['talent@fintechpay.com']) {
      const j2 = await client.query(
        `INSERT INTO jobs (company_id, employer_id, title, description, category, employment_type, location, experience_level, salary_min, salary_max, salary_currency, skills, status)
         VALUES 
         ($1, $2, 'Backend Node.js & Database Architect', 
          'Build high-throughput transaction processing APIs with Node.js, Express, and PostgreSQL. Design idempotent payment workflows and robust database transactions.',
          'Backend Engineering', 'Full-time', 'New York, NY', 'Senior', 140000, 180000, 'USD',
          ARRAY['Node.js', 'Express', 'PostgreSQL', 'Redis', 'TypeScript', 'Microservices'], 'open'),
         ($1, $2, 'Product Designer (Design Systems)',
          'Lead the mobile and web experience for PayPulse dashboard and merchant checkout surfaces.',
          'Design', 'Remote', 'Remote', 'Mid', 105000, 135000, 'USD',
          ARRAY['Figma', 'UI/UX', 'Mobile Design', 'Design Systems'], 'open')
         RETURNING id;`,
        [finTechId, userMap['talent@fintechpay.com']]
      );
    }

    // 5. Skills Master List
    const skillsList = [
      'React Native', 'Expo', 'React.js', 'TypeScript', 'JavaScript',
      'Node.js', 'Express.js', 'PostgreSQL', 'SQL', 'MongoDB',
      'Docker', 'Kubernetes', 'AWS', 'GraphQL', 'REST APIs',
      'Figma', 'UI/UX Design', 'TailwindCSS', 'CSS', 'HTML5',
      'Git', 'CI/CD', 'Python', 'Java', 'Go'
    ];

    for (const skill of skillsList) {
      await client.query(
        `INSERT INTO skills (name) VALUES ($1) ON CONFLICT (name) DO NOTHING;`,
        [skill]
      );
    }

    // 6. Sample Application & Saved Job
    const candidateId = userMap['alex.dev@gmail.com'];
    const jobRes = await client.query(`SELECT id FROM jobs LIMIT 2;`);
    if (candidateId && jobRes.rows.length > 0) {
      const firstJobId = jobRes.rows[0].id;
      const secondJobId = jobRes.rows[1]?.id;

      await client.query(
        `INSERT INTO applications (job_id, candidate_id, cover_note, resume_url, status)
         VALUES ($1, $2, 'I have 5 years building React Native and Expo applications with high performance and clean architectures.', 'https://ronojobs.com/resumes/alex_rivera_cv.pdf', 'Applied')
         ON CONFLICT (job_id, candidate_id) DO NOTHING;`,
        [firstJobId, candidateId]
      );

      if (secondJobId) {
        await client.query(
          `INSERT INTO saved_jobs (user_id, job_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, job_id) DO NOTHING;`,
          [candidateId, secondJobId]
        );
      }
    }

    await client.query('COMMIT');
    console.log('✅ Database seeded successfully with demo users, companies, jobs, and applications.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runSeeds()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
