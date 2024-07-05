function SidebarIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Add the vertical line */}
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2 4v16"/>
      {/* Shift the existing horizontal lines to the right */}
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6h16"/>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 12h16"/>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18h7"/>
    </svg>
  );
}

export default SidebarIcon;
