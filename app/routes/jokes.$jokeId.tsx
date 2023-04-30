import type { ActionArgs, LoaderArgs, V2_MetaFunction } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { json } from '@remix-run/node';
import {
  Link,
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  useParams,
  Form,
} from '@remix-run/react';

import { db } from '~/utils/db.server';
import { getUserId } from '~/utils/session.server';
import { requireUserId } from '~/utils/session.server';

export const meta: V2_MetaFunction<typeof loader> = ({ data }) => {
  const { description, title } = data
    ? {
        description: `Enjoy the "${data.joke.name}" joke and much more`,
        title: `"${data.joke.name}" joke`,
      }
    : { description: 'No joke found', title: 'No joke' };

  return [
    { name: 'description', content: description },
    { name: 'twitter:description', content: description },
    { title },
  ];
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const userId = await getUserId(request);
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response('What a joke! Not found.', {
      status: 404,
    });
  }
  return json({ joke, isOwner: joke.jokesterId === userId });
};

export const action = async ({ request, params }: ActionArgs) => {
  const form = await request.formData();
  if (form.get('intent') !== 'delete') {
    throw new Response(`The intent "${form.get('intent')}" is not supported`, {
      status: 400,
    });
  }
  // get user id from session
  const userId = await requireUserId(request);
  // get joke from db
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  // if no joke, return 404
  if (!joke) {
    throw new Response('What a joke! Not found.', {
      status: 404,
    });
  }
  // if no user id or joke's jokesterId doesn't match user id, return 403
  if (joke.jokesterId !== userId) {
    return new Response('That joke does not belong to you', { status: 403 });
  }
  // otherwise, delete joke from db
  await db.joke.delete({ where: { id: params.jokeId } });
  return redirect('/jokes');
};

export default function JokeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <p>Here's your hilarious joke:</p>
      <p>{data.joke.content}</p>
      <Link to=".">{data.joke.name} Permalink</Link>
      {data.isOwner ? (
        <Form method="post">
          <button className="button" name="intent" type="submit" value="delete">
            Delete
          </button>
        </Form>
      ) : null}
    </div>
  );
}

export function ErrorBoundary() {
  const { jokeId } = useParams();
  let error = useRouteError();

  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 400: {
        return (
          <div className="error-container">
            What you're trying to do is not allowed.
          </div>
        );
      }
      case 404: {
        return (
          <div className="error-container">Huh? What the heck is {jokeId}?</div>
        );
      }
      case 403: {
        return (
          <div className="error-container">
            Sorry, but {jokeId} is not your joke.
          </div>
        );
      }
      default: {
        throw new Error(`Unhandled error: ${error.status}`);
      }
    }
  } else if (error instanceof Error) {
    return (
      <div>
        <div className="error-container">{`There was an error loading joke by the id ${jokeId}. Sorry.`}</div>
      </div>
    );
  } else {
    return <h1>Unknown Error</h1>;
  }
}
