const app=require('./app');


const databaseConnect=require('./config/databaseConfig')
databaseConnect()



const PORT=process.env.PORT || 3005;
app.listen(PORT,()=>{
    console.log('port running on ',PORT)
})