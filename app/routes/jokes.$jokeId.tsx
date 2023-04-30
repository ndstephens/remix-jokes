import type { LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import {
  Link,
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  useParams,
} from '@remix-run/react';

import { db } from '~/utils/db.server';

export const loader = async ({ params }: LoaderArgs) => {
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response('What a joke! Not found.', {
      status: 404,
    });
  }
  return json({ joke });
};

export default function JokeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <p>Here's your hilarious joke:</p>
      <p>{data.joke.content}</p>
      <Link to=".">{data.joke.name} Permalink</Link>
    </div>
  );
}

export function ErrorBoundary() {
  const { jokeId } = useParams();
  let error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="error-container">Huh? What the heck is "{jokeId}"?</div>
      );
    }
    throw new Error(`Unhandled error: ${error.status}`);
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
