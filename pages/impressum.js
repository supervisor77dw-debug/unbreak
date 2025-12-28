export default function Page() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/impressum.html',
      permanent: false,
    },
  };
}