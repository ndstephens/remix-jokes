import { db } from '~/utils/db.server';
import bcrypt from 'bcryptjs';
import { createCookieSessionStorage, redirect } from '@remix-run/node';

//* =============================================
//*                   LOGIN                     =
//*==============================================
type LoginForm = {
  username: string;
  password: string;
};

export async function login({ username, password }: LoginForm) {
  const user = await db.user.findUnique({
    where: {
      username,
    },
  });

  if (!user) return null;

  const isCorrectPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isCorrectPassword) return null;

  return { id: user.id, username };
}

//* =============================================
//*                 REGISTER                    =
//*==============================================
type RegisterForm = {
  username: string;
  password: string;
};

export async function register({ username, password }: RegisterForm) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: {
      username,
      passwordHash,
    },
  });
  return { id: user.id, username };
}

//* =============================================
//*                 USER SESSION                =
//*==============================================
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error('SESSION_SECRET must be set');
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'RJ_session',
    // normally you want this to be `secure: true`
    // but that doesn't work on localhost for Safari
    // https://web.dev/when-to-use-local-https/
    secure: process.env.NODE_ENV === 'production',
    secrets: [sessionSecret],
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
  },
});

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set('userId', userId);
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.commitSession(session),
    },
  });
}

export async function getUserSession(request: Request) {
  return sessionStorage.getSession(request.headers.get('Cookie'));
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get('userId');
  if (!userId || typeof userId !== 'string') return null;
  return userId;
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const session = await getUserSession(request);
  const userId = session.get('userId');
  if (!userId || typeof userId !== 'string') {
    const searchParams = new URLSearchParams([['redirectTo', redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

//* =============================================
//*                 GET USER                    =
//*==============================================
export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (typeof userId !== 'string') {
    return null;
  }

  try {
    const user = await db.user.findUnique({
      select: { id: true, username: true },
      where: { id: userId },
    });
    return user;
  } catch {
    throw logout(request);
  }
}

//* =============================================
//*                   LOGOUT                    =
//*==============================================
export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect('/login', {
    headers: {
      'Set-Cookie': await sessionStorage.destroySession(session),
    },
  });
}
