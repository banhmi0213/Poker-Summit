import {checkPokerStaging} from './staging-check';
void checkPokerStaging(process.env).then(result=>console.log(JSON.stringify(result)),error=>{
 const allowed=['staging_configuration_invalid','supabase_auth_failed','startup_rpc_failed','backend_probe_failed','unauthenticated_boundary_failed'];
 console.error(allowed.includes(error?.message)?error.message:'staging_check_failed');process.exitCode=1;
});
