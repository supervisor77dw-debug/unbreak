export default function Page() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/configurator.html',
      permanent: false,
    },
  };
}