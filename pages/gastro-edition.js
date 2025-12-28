export default function Page() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/gastro-edition.html',
      permanent: false,
    },
  };
}